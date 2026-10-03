namespace ElitePos.LocalService.Models;

public sealed class DatabaseOptions
{
    public const string SectionName = "Database";

    public string Provider { get; init; } = "SQLite";
    public string SqliteConnectionString { get; init; } = "Data Source=data/elite-pos.db";
}

public sealed record DatabaseStatus(string Provider, bool Connected, string Message);
