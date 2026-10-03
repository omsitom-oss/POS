using ElitePos.LocalService.Services;

namespace ElitePos.LocalService.Endpoints;

public static class ReportEndpoints
{
    public static IEndpointRouteBuilder MapReportEndpoints(this IEndpointRouteBuilder endpoints)
    {
        endpoints.MapGet("/api/reports/summary",async(DateTime? from,DateTime? to,ReportService service,CancellationToken ct)=>Results.Ok(await service.GetSummaryAsync(from,to,ct)));return endpoints;
    }
}
