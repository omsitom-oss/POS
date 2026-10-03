using System.Data.Common;

namespace ElitePos.LocalService.Data;

public sealed class SchemaVersionStore(DbConnectionFactory connectionFactory)
{
    public async Task EnsureInfrastructureAsync(CancellationToken cancellationToken = default)
    {
        await using var connection = connectionFactory.CreateConnection();
        await connection.OpenAsync(cancellationToken);

        await using var command = connection.CreateCommand();
        command.CommandText = connection is Microsoft.Data.Sqlite.SqliteConnection
            ? """
              CREATE TABLE IF NOT EXISTS SchemaMigrations (
                  Version INTEGER NOT NULL PRIMARY KEY,
                  Description TEXT NOT NULL,
                  AppliedAtUtc TEXT NOT NULL
              );
              """
            : """
              IF OBJECT_ID(N'dbo.SchemaMigrations', N'U') IS NULL
              BEGIN
                  CREATE TABLE dbo.SchemaMigrations (
                      Version INT NOT NULL PRIMARY KEY,
                      Description NVARCHAR(250) NOT NULL,
                      AppliedAtUtc DATETIME2 NOT NULL
                  );
              END;
              """;

        await command.ExecuteNonQueryAsync(cancellationToken);
    }
}
