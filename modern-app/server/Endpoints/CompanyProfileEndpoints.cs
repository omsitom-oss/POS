using ElitePos.LocalService.Models;
using ElitePos.LocalService.Security;
using ElitePos.LocalService.Services;

namespace ElitePos.LocalService.Endpoints;

public static class CompanyProfileEndpoints
{
    public static IEndpointRouteBuilder MapCompanyProfileEndpoints(this IEndpointRouteBuilder endpoints)
    {
        var group = endpoints.MapGroup("/api/company-profile").RequireAuthorization(); var write = group.MapGroup("").RequirePermission(PermissionCodes.SettingsManage);
        group.MapGet("", async (CompanyProfileService service, CancellationToken ct) => Results.Ok(await service.GetAsync(ct)));
        write.MapPut("", async (CompanyProfileWriteRequest request, CompanyProfileService service, CancellationToken ct) => { try { return Results.Ok(await service.SaveAsync(request, ct)); } catch (CompanyProfileException ex) { return Results.Problem(ex.Message, statusCode: ex.StatusCode); } });
        return endpoints;
    }
}
