using System.Security.Claims;
using ElitePos.LocalService.Security;

namespace ElitePos.LocalService.Tests;

public sealed class SecurityUnitTests
{
    private static ClaimsPrincipal User(int branchId, params string[] permissions) => new(new ClaimsIdentity(
        new[] { new Claim(PosClaims.UserId, "7"), new Claim(PosClaims.BranchId, branchId.ToString()) }
            .Concat(permissions.Select(code => new Claim(PosClaims.Permission, code))), "test"));

    [Fact]
    public void Writes_default_to_the_users_branch_and_refuse_others()
    {
        var user = User(3);
        Assert.Equal(3, user.ForWrite(null));
        Assert.Equal(3, user.ForWrite(3));
        Assert.Throws<BranchAccessException>(() => user.ForWrite(4));
    }

    [Fact]
    public void Reads_are_held_to_the_users_branch()
    {
        var user = User(3);
        Assert.Equal(3, user.ForRead(null));
        Assert.Throws<BranchAccessException>(() => user.ForRead(4));
        Assert.True(user.CanAccessBranch(3));
        Assert.False(user.CanAccessBranch(4));
    }

    [Fact]
    public void All_branches_users_may_name_any_branch_or_none()
    {
        var user = User(3, PermissionCodes.AllBranches);
        Assert.Equal(4, user.ForWrite(4));
        Assert.Null(user.ForRead(null));
        Assert.Equal(4, user.ForRead(4));
        Assert.True(user.CanAccessBranch(4));
    }

    [Fact]
    public void Passwords_hash_with_a_salt_and_verify()
    {
        var first = PasswordHasher.Hash("Correct-Horse-1");
        Assert.NotEqual(first, PasswordHasher.Hash("Correct-Horse-1"));
        Assert.StartsWith("PBKDF2-SHA256$120000$", first);
        Assert.True(PasswordHasher.Verify("Correct-Horse-1", first));
        Assert.False(PasswordHasher.Verify("correct-horse-1", first));
        Assert.False(PasswordHasher.Verify("anything", "not-a-hash"));
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("123456")]
    [InlineData("       ")]
    public void Weak_passwords_are_rejected(string? password) => Assert.NotNull(PasswordHasher.Validate(password));

    [Fact]
    public void Temporary_passwords_are_random_and_valid()
    {
        var first = PasswordHasher.GenerateTemporary();
        Assert.Null(PasswordHasher.Validate(first));
        Assert.NotEqual(first, PasswordHasher.GenerateTemporary());
    }
}
