using System.Data.Common;
using ElitePos.LocalService.Models;
using Microsoft.Data.SqlClient;
using Microsoft.Data.Sqlite;

namespace ElitePos.LocalService.Data;

public sealed class DbConnectionFactory(DatabaseOptions options, IConfiguration configuration, IHostEnvironment environment)
{
    public string ProviderName => options.Provider;

    public DbConnection CreateConnection()
    {
        if (options.Provider.Equals("SqlServer", StringComparison.OrdinalIgnoreCase))
        {
            var connectionString = configuration.GetConnectionString("POS");
            if (string.IsNullOrWhiteSpace(connectionString))
            {
                throw new InvalidOperationException("ConnectionStrings:POS must be configured when Database:Provider is SqlServer.");
            }

            var builder = new SqlConnectionStringBuilder(connectionString);
            if (!builder.IntegratedSecurity)
            {
                throw new InvalidOperationException(
                    "SQL Server connections must use Windows Integrated Security. SQL credentials are not supported here.");
            }

            return new SqlConnection(builder.ConnectionString);
        }

        if (options.Provider.Equals("SQLite", StringComparison.OrdinalIgnoreCase))
        {
            var builder = new SqliteConnectionStringBuilder(options.SqliteConnectionString);
            if (builder.DataSource != ":memory:" && !Path.IsPathRooted(builder.DataSource))
            {
                builder.DataSource = Path.GetFullPath(Path.Combine(environment.ContentRootPath, builder.DataSource));
            }

            if (builder.DataSource != ":memory:")
            {
                var directory = Path.GetDirectoryName(builder.DataSource);
                if (!string.IsNullOrWhiteSpace(directory))
                {
                    Directory.CreateDirectory(directory);
                }
            }

            return new SqliteConnection(builder.ConnectionString);
        }

        throw new InvalidOperationException(
            $"Unsupported database provider '{options.Provider}'. Use 'SqlServer' or 'SQLite'.");
    }
}
