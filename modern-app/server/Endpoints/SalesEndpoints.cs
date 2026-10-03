using ElitePos.LocalService.Models;
using ElitePos.LocalService.Services;

namespace ElitePos.LocalService.Endpoints;

public static class SalesEndpoints
{
    public static IEndpointRouteBuilder MapSalesEndpoints(this IEndpointRouteBuilder endpoints)
    {
        var group=endpoints.MapGroup("/api/sales");group.MapGet("",async(DateTime? from,DateTime? to,SalesService service,CancellationToken ct)=>Results.Ok(await service.GetAsync(from,to,ct)));group.MapPost("",async(SaleWriteRequest request,SalesService service,CancellationToken ct)=>{try{return Results.Created("/api/sales",await service.CreateAsync(request,ct));}catch(SalesException ex){return Results.Problem(ex.Message,statusCode:ex.StatusCode);}});return endpoints;
    }
}
