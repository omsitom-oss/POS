using System.Security.Cryptography;

namespace ElitePos.LocalService.Security;

public static class PasswordHasher
{
    public const int MinimumLength = 8;
    public const int MaximumLength = 128;
    private const int Iterations = 120000;
    private const string TemporaryAlphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";

    public static string Hash(string password)
    {
        var salt = RandomNumberGenerator.GetBytes(16);
        var hash = Rfc2898DeriveBytes.Pbkdf2(password, salt, Iterations, HashAlgorithmName.SHA256, 32);
        return $"PBKDF2-SHA256${Iterations}${Convert.ToBase64String(salt)}${Convert.ToBase64String(hash)}";
    }

    public static bool Verify(string password, string encoded)
    {
        try
        {
            var parts = encoded.Split('$');
            if (parts.Length != 4 || !int.TryParse(parts[1], out var iterations) || iterations is < 1 or > 10_000_000) return false;
            var salt = Convert.FromBase64String(parts[2]);
            var expected = Convert.FromBase64String(parts[3]);
            if (salt.Length == 0 || expected.Length == 0) return false;
            var actual = Rfc2898DeriveBytes.Pbkdf2(password, salt, iterations, HashAlgorithmName.SHA256, expected.Length);
            return CryptographicOperations.FixedTimeEquals(actual, expected);
        }
        catch (Exception ex) when (ex is FormatException or ArgumentException)
        {
            return false;
        }
    }

    // Returns an error message, or null when the password is acceptable.
    public static string? Validate(string? password)
    {
        if (string.IsNullOrEmpty(password) || password.Length < MinimumLength)
            return $"Password must be at least {MinimumLength} characters.";
        if (password.Length > MaximumLength)
            return $"Password must be {MaximumLength} characters or fewer.";
        if (string.IsNullOrWhiteSpace(password))
            return "Password cannot be blank.";
        return null;
    }

    // One-time password shown once to the administrator; the user must change it on first login.
    public static string GenerateTemporary(int length = 12) => RandomNumberGenerator.GetString(TemporaryAlphabet, length);
}
