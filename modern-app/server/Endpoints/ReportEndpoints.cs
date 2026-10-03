using System.Security.Claims;
using ElitePos.LocalService.Security;
using ElitePos.LocalService.Services;

namespace ElitePos.LocalService.Endpoints;

public static class ReportEndpoints
{
    public static IEndpointRouteBuilder MapReportEndpoints(this IEndpointRouteBuilder endpoints)
    {
        endpoints.MapGet("/api/reports/summary",async(int? branchId,DateTime? from,DateTime? to,ClaimsPrincipal user,ReportService service,CancellationToken ct)=>Results.Ok(await service.GetSummaryAsync(user.ForRead(branchId),from,to,ct))).RequirePermission(PermissionCodes.ReportsView);return endpoints;
    }
}
