using System.Text.RegularExpressions;
using ElitePos.LocalService.Data.Pos;

namespace ElitePos.LocalService.Tests;

public sealed class MigrationScriptTests
{
    private static readonly System.Reflection.Assembly Server = typeof(PosMigrationRunner).Assembly;

    [Fact]
    public void Pos_stream_contains_only_pos_scripts()
    {
        var migrations = PosMigrationRunner.GetMigrations();

        Assert.NotEmpty(migrations);
        Assert.All(migrations, migration => Assert.Contains(".Data.Pos.Migrations.", migration.Name));
    }

    [Fact]
    public void Pos_versions_are_unique_and_contiguous_from_one()
    {
        var versions = PosMigrationRunner.GetMigrations().Select(migration => migration.Version).ToArray();

        Assert.Equal(Enumerable.Range(1, versions.Length), versions);
    }

    [Fact]
    public void Management_scripts_the_runner_loads_by_name_are_embedded()
    {
        var names = Server.GetManifestResourceNames();

        Assert.Contains("server.Data.Management.Migrations.001_InitialManagementSchema.sql", names);
        Assert.Contains("server.Data.Management.Migrations.002_AddPartnerTypeAndMigrateLegacyPartners.sql", names);
    }

    [Fact]
    public void Scripts_have_no_batch_separators()
    {
        // Each script runs as a single command, so a GO line would be a syntax error at migration time.
        var offenders = Server.GetManifestResourceNames()
            .Where(name => name.EndsWith(".sql", StringComparison.OrdinalIgnoreCase))
            .Where(name => Regex.IsMatch(MigrationSql.Read(name), @"^\s*GO\s*$", RegexOptions.Multiline | RegexOptions.IgnoreCase))
            .ToArray();

        Assert.Empty(offenders);
    }
}

internal static class MigrationSql
{
    public static string Read(string resourceName)
    {
        using var stream = typeof(PosMigrationRunner).Assembly.GetManifestResourceStream(resourceName)
            ?? throw new InvalidOperationException($"Missing resource {resourceName}.");
        using var reader = new StreamReader(stream);
        return reader.ReadToEnd();
    }
}
