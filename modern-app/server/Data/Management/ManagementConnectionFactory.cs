using Microsoft.Data.SqlClient;

namespace ElitePos.LocalService.Data.Management;

public sealed class ManagementConnectionFactory(IConfiguration configuration)
{
    public SqlConnection CreateConnection()
    {
        var connectionString = configuration.GetConnectionString("POSManagement");
        if (string.IsNullOrWhiteSpace(connectionString))
        {
            throw new InvalidOperationException(
                "ConnectionStrings:POSManagement must be configured through User Secrets or environment configuration.");
        }

        var builder = new SqlConnectionStringBuilder(connectionString);
        if (!string.Equals(builder.InitialCatalog, "POSManagement", StringComparison.OrdinalIgnoreCase))
        {
            throw new InvalidOperationException("The Management connection must target POSManagement.");
        }

        builder.PersistSecurityInfo = false;
        builder.ApplicationName = "Elite POS Management";
        return new SqlConnection(builder.ConnectionString);
    }
}
