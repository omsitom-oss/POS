using System.ComponentModel.DataAnnotations;
using System.Security.Cryptography;
using ElitePos.LocalService.Data.Management;
using ElitePos.LocalService.Models;
using Microsoft.Data.SqlClient;

namespace ElitePos.LocalService.Services;

public sealed class ManagementService(ManagementConnectionFactory connectionFactory)
{
    public async Task<bool> CheckHealthAsync(CancellationToken cancellationToken)
    {
        await using var connection = connectionFactory.CreateConnection();
        await connection.OpenAsync(cancellationToken);
        await using var command = new SqlCommand("SELECT DB_NAME();", connection);
        var databaseName = (string?)await command.ExecuteScalarAsync(cancellationToken);
        return string.Equals(databaseName, "POSManagement", StringComparison.Ordinal);
    }

    public async Task<IReadOnlyList<BusinessTypeDto>> GetBusinessTypesAsync(CancellationToken cancellationToken)
    {
        const string sql = """
            SELECT BusinessTypeId, Code, Name, Description
            FROM dbo.BusinessTypes
            WHERE IsActive = 1
            ORDER BY Name, Code;
            """;
        await using var connection = connectionFactory.CreateConnection();
        await connection.OpenAsync(cancellationToken);
        await using var command = new SqlCommand(sql, connection);
        await using var reader = await command.ExecuteReaderAsync(cancellationToken);
        var results = new List<BusinessTypeDto>();
        while (await reader.ReadAsync(cancellationToken))
        {
            results.Add(new BusinessTypeDto(reader.GetString(1), reader.GetString(2),
                reader.IsDBNull(3) ? null : reader.GetString(3)));
        }
        return results;
    }

    public async Task<IReadOnlyList<CustomerListItemDto>> GetCustomersAsync(CancellationToken cancellationToken)
    {
        const string sql = """
            SELECT c.PublicId, c.CustomerCode, c.BusinessName, c.PartnerTypeCode, bt.Name,
                   c.ContactPerson, c.Phone, c.Country, c.Status, c.CreatedAt
            FROM dbo.Customers AS c
            LEFT JOIN dbo.CustomerBusinessTypes AS cbt
                ON cbt.CustomerId = c.CustomerId AND cbt.IsPrimary = 1
            LEFT JOIN dbo.BusinessTypes AS bt ON bt.BusinessTypeId = cbt.BusinessTypeId
            ORDER BY c.BusinessName, c.CustomerCode;
            """;
        await using var connection = connectionFactory.CreateConnection();
        await connection.OpenAsync(cancellationToken);
        await using var command = new SqlCommand(sql, connection);
        await using var reader = await command.ExecuteReaderAsync(cancellationToken);
        var results = new List<CustomerListItemDto>();
        while (await reader.ReadAsync(cancellationToken))
        {
            results.Add(new CustomerListItemDto(
                reader.GetGuid(0), reader.GetString(1), reader.GetString(2), reader.GetString(3),
                reader.IsDBNull(4) ? null : reader.GetString(4),
                reader.IsDBNull(5) ? null : reader.GetString(5),
                reader.IsDBNull(6) ? null : reader.GetString(6),
                reader.IsDBNull(7) ? null : reader.GetString(7),
                reader.GetString(8), AsUtc(reader.GetDateTime(9))));
        }
        return results;
    }

    public async Task<CustomerDetailsDto?> GetCustomerAsync(Guid publicId, CancellationToken cancellationToken)
    {
        const string customerSql = """
            SELECT CustomerId, PublicId, CustomerCode, BusinessName, PartnerTypeCode, ContactPerson, Phone, Mobile,
                   Email, Address, City, Country, TaxNumber, Notes, Status, CreatedAt
            FROM dbo.Customers WHERE PublicId = @PublicId;
            """;
        await using var connection = connectionFactory.CreateConnection();
        await connection.OpenAsync(cancellationToken);
        int customerId;
        CustomerDetailsDto customer;
        await using (var command = new SqlCommand(customerSql, connection))
        {
            command.Parameters.Add("@PublicId", System.Data.SqlDbType.UniqueIdentifier).Value = publicId;
            await using var reader = await command.ExecuteReaderAsync(cancellationToken);
            if (!await reader.ReadAsync(cancellationToken)) return null;
            customerId = reader.GetInt32(0);
            customer = new CustomerDetailsDto(
                reader.GetGuid(1), reader.GetString(2), reader.GetString(3), reader.GetString(4),
                NullableString(reader, 5), NullableString(reader, 6), NullableString(reader, 7),
                NullableString(reader, 8), NullableString(reader, 9), NullableString(reader, 10),
                NullableString(reader, 11), NullableString(reader, 12), NullableString(reader, 13),
                reader.GetString(14), AsUtc(reader.GetDateTime(15)), Array.Empty<BusinessTypeDto>());
        }

        const string typesSql = """
            SELECT bt.BusinessTypeId, bt.Code, bt.Name, bt.Description
            FROM dbo.CustomerBusinessTypes AS cbt
            JOIN dbo.BusinessTypes AS bt ON bt.BusinessTypeId = cbt.BusinessTypeId
            WHERE cbt.CustomerId = @CustomerId
            ORDER BY cbt.IsPrimary DESC, bt.Name;
            """;
        await using var typesCommand = new SqlCommand(typesSql, connection);
        typesCommand.Parameters.Add("@CustomerId", System.Data.SqlDbType.Int).Value = customerId;
        await using var typesReader = await typesCommand.ExecuteReaderAsync(cancellationToken);
        var types = new List<BusinessTypeDto>();
        while (await typesReader.ReadAsync(cancellationToken))
        {
            types.Add(new BusinessTypeDto(typesReader.GetString(1), typesReader.GetString(2), NullableString(typesReader, 3)));
        }
        return customer with { BusinessTypes = types };
    }

    public async Task<CustomerDetailsDto> CreateCustomerAsync(CreateCustomerRequest request, CancellationToken cancellationToken)
    {
        var businessName = request.BusinessName?.Trim();
        var typeCode = request.PrimaryBusinessTypeCode?.Trim();
        var partnerTypeCode = request.PartnerTypeCode?.Trim().ToUpperInvariant();
        if (string.IsNullOrWhiteSpace(businessName)) throw new ArgumentException("Business name is required.");
        if (businessName.Length > 200) throw new ArgumentException("Business name must be 200 characters or fewer.");
        if (string.IsNullOrWhiteSpace(typeCode) || typeCode.Length > 50) throw new ArgumentException("Choose an active primary business type.");
        if (partnerTypeCode is not ("CLIENT" or "SUPPLIER" or "BOTH")) throw new ArgumentException("Choose a partner type.");
        if (!string.IsNullOrWhiteSpace(request.Email) && !new EmailAddressAttribute().IsValid(request.Email.Trim()))
            throw new ArgumentException("Enter a valid email address.");

        await using var connection = connectionFactory.CreateConnection();
        await connection.OpenAsync(cancellationToken);
        await using var transaction = (SqlTransaction)await connection.BeginTransactionAsync(cancellationToken);
        try
        {
            const string typeSql = "SELECT BusinessTypeId, Name FROM dbo.BusinessTypes WHERE Code = @Code AND IsActive = 1;";
            await using var typeCommand = new SqlCommand(typeSql, connection, transaction);
            typeCommand.Parameters.Add("@Code", System.Data.SqlDbType.NVarChar, 50).Value = typeCode;
            int businessTypeId;
            string businessTypeName;
            await using (var typeReader = await typeCommand.ExecuteReaderAsync(cancellationToken))
            {
                if (!await typeReader.ReadAsync(cancellationToken)) throw new ArgumentException("The selected business type is unavailable.");
                businessTypeId = typeReader.GetInt32(0);
                businessTypeName = typeReader.GetString(1);
            }

            const string insertCustomerSql = """
                INSERT INTO dbo.Customers
                    (PublicId, CustomerCode, BusinessName, PartnerTypeCode, ContactPerson, Phone, Mobile, Email, Address, City, Country, TaxNumber, Notes)
                OUTPUT inserted.CustomerId, inserted.PublicId, inserted.CustomerCode, inserted.CreatedAt
                VALUES
                    (@PublicId, @CustomerCode, @BusinessName, @PartnerTypeCode, @ContactPerson, @Phone, @Mobile, @Email, @Address, @City, @Country, @TaxNumber, @Notes);
                """;
            var publicId = Guid.NewGuid();
            var customerCode = CreateCustomerCode();
            int customerId;
            DateTime createdAt;
            await using (var customerCommand = new SqlCommand(insertCustomerSql, connection, transaction))
            {
                customerCommand.Parameters.Add("@PublicId", System.Data.SqlDbType.UniqueIdentifier).Value = publicId;
                customerCommand.Parameters.Add("@CustomerCode", System.Data.SqlDbType.NVarChar, 24).Value = customerCode;
                AddString(customerCommand, "@BusinessName", 200, businessName);
                customerCommand.Parameters.Add("@PartnerTypeCode", System.Data.SqlDbType.NVarChar, 20).Value = partnerTypeCode!;
                AddString(customerCommand, "@ContactPerson", 150, request.ContactPerson);
                AddString(customerCommand, "@Phone", 50, request.Phone);
                AddString(customerCommand, "@Mobile", 50, request.Mobile);
                AddString(customerCommand, "@Email", 254, request.Email);
                AddString(customerCommand, "@Address", 500, request.Address);
                AddString(customerCommand, "@City", 100, request.City);
                AddString(customerCommand, "@Country", 100, request.Country);
                AddString(customerCommand, "@TaxNumber", 100, request.TaxNumber);
                AddString(customerCommand, "@Notes", 1000, request.Notes);
                await using var reader = await customerCommand.ExecuteReaderAsync(cancellationToken);
                await reader.ReadAsync(cancellationToken);
                customerId = reader.GetInt32(0);
                createdAt = AsUtc(reader.GetDateTime(3));
            }

            const string linkSql = """
                INSERT INTO dbo.CustomerBusinessTypes (CustomerId, BusinessTypeId, IsPrimary)
                VALUES (@CustomerId, @BusinessTypeId, 1);
                """;
            await using (var linkCommand = new SqlCommand(linkSql, connection, transaction))
            {
                linkCommand.Parameters.Add("@CustomerId", System.Data.SqlDbType.Int).Value = customerId;
                linkCommand.Parameters.Add("@BusinessTypeId", System.Data.SqlDbType.Int).Value = businessTypeId;
                await linkCommand.ExecuteNonQueryAsync(cancellationToken);
            }

            await transaction.CommitAsync(cancellationToken);
            return new CustomerDetailsDto(publicId, customerCode, businessName, partnerTypeCode!,
                Clean(request.ContactPerson), Clean(request.Phone), Clean(request.Mobile), Clean(request.Email),
                Clean(request.Address), Clean(request.City), Clean(request.Country), Clean(request.TaxNumber),
                Clean(request.Notes), "ACTIVE", createdAt,
                [new BusinessTypeDto(typeCode, businessTypeName, null)]);
        }
        catch
        {
            try { await transaction.RollbackAsync(CancellationToken.None); }
            catch (InvalidOperationException) { }
            throw;
        }
    }

    private static string CreateCustomerCode()
    {
        const string alphabet = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";
        return "EL-" + string.Create(10, alphabet, (span, chars) =>
        {
            for (var index = 0; index < span.Length; index++) span[index] = chars[RandomNumberGenerator.GetInt32(chars.Length)];
        });
    }

    private static void AddString(SqlCommand command, string name, int size, string? value)
    {
        var cleaned = Clean(value);
        command.Parameters.Add(name, System.Data.SqlDbType.NVarChar, size).Value = (object?)cleaned ?? DBNull.Value;
    }

    private static string? Clean(string? value)
    {
        var cleaned = value?.Trim();
        return string.IsNullOrEmpty(cleaned) ? null : cleaned;
    }

    private static DateTime AsUtc(DateTime value) => DateTime.SpecifyKind(value, DateTimeKind.Utc);

    private static string? NullableString(SqlDataReader reader, int ordinal) => reader.IsDBNull(ordinal) ? null : reader.GetString(ordinal);
}
