using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;

namespace ElitePos.LocalService.Tests;

// Hosts the real API in memory against a throwaway SQLite file, so tests never need the developer's SQL Server.
public sealed class ApiFactory : WebApplicationFactory<Program>
{
    private readonly string databaseDirectory = Path.Combine(Path.GetTempPath(), "elite-pos-tests", Guid.NewGuid().ToString("N"));

    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        builder.UseEnvironment("Testing");
        builder.UseSetting("Database:Provider", "SQLite");
        builder.UseSetting("Database:SqliteConnectionString", $"Data Source={Path.Combine(databaseDirectory, "pos.db")};Pooling=False");
    }

    protected override void Dispose(bool disposing)
    {
        base.Dispose(disposing);
        if (disposing && Directory.Exists(databaseDirectory)) Directory.Delete(databaseDirectory, recursive: true);
    }
}
