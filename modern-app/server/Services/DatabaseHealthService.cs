using ElitePos.LocalService.Data;
using ElitePos.LocalService.Models;

namespace ElitePos.LocalService.Services;

public sealed class DatabaseHealthService(DbConnectionFactory connectionFactory, ILogger<DatabaseHealthService> logger)
{
    public async Task<DatabaseStatus> CheckAsync(CancellationToken cancellationToken = default)
    {
        try
        {
            await using var connection = connectionFactory.CreateConnection();
            await connection.OpenAsync(cancellationToken);
            await using var command = connection.CreateCommand();
            command.CommandText = "SELECT 1";
            await command.ExecuteScalarAsync(cancellationToken);
            return new DatabaseStatus(connectionFactory.ProviderName, true, "Database connection is ready.");
        }
        catch (Exception exception)
        {
            logger.LogWarning(exception, "The configured database connection is unavailable.");
            return new DatabaseStatus(connectionFactory.ProviderName, false, "Database connection failed. Check local provider configuration.");
        }
    }
}
