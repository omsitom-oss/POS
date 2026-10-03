namespace ElitePos.LocalService.Security;

public sealed class AuthOptions
{
    public const string SectionName = "Auth";

    // A session ends after this many minutes without a request.
    public int SessionIdleMinutes { get; set; } = 120;

    // A session ends this many minutes after login, whatever the activity.
    public int SessionLifetimeMinutes { get; set; } = 720;

    // Failed logins in a row before the account is locked.
    public int MaxFailedLogins { get; set; } = 5;

    public int LockoutMinutes { get; set; } = 15;
}
