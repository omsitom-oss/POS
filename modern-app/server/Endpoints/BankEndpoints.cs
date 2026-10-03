using ElitePos.LocalService.Models;
using ElitePos.LocalService.Security;
using ElitePos.LocalService.Services;
namespace ElitePos.LocalService.Endpoints;
public static class BankEndpoints
{
 public static IEndpointRouteBuilder MapBankEndpoints(this IEndpointRouteBuilder endpoints){var group = endpoints.MapGroup("/api/banks").RequireAuthorization(); var write = group.MapGroup("").RequirePermission(PermissionCodes.SettingsManage);group.MapGet("",async(bool? includeInactive,BankService service,CancellationToken ct)=>Results.Ok(await service.GetAsync(includeInactive==true,ct)));write.MapPost("",(BankWriteRequest request,BankService service,CancellationToken ct)=>Save(null,request,service,ct));write.MapPut("/{id:int}",(int id,BankWriteRequest request,BankService service,CancellationToken ct)=>Save(id,request,service,ct));write.MapPost("/{id:int}/activate",(int id,BankService service,CancellationToken ct)=>SetActive(id,true,service,ct));write.MapPost("/{id:int}/deactivate",(int id,BankService service,CancellationToken ct)=>SetActive(id,false,service,ct));return endpoints;}
 private static async Task<IResult> Save(int? id,BankWriteRequest request,BankService service,CancellationToken ct){try{var result=await service.SaveAsync(id,request,ct);return id.HasValue?Results.Ok(result):Results.Created("/api/banks",result);}catch(BankException ex){return Results.Problem(ex.Message,statusCode:ex.StatusCode);}}
 private static async Task<IResult> SetActive(int id,bool active,BankService service,CancellationToken ct){try{return await service.SetActiveAsync(id,active,ct)?Results.NoContent():Results.NotFound();}catch(BankException ex){return Results.Problem(ex.Message,statusCode:ex.StatusCode);}}
}
