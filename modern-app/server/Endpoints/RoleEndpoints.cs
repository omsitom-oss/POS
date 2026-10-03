using ElitePos.LocalService.Models;
using ElitePos.LocalService.Security;
using ElitePos.LocalService.Services;

namespace ElitePos.LocalService.Endpoints;

public static class RoleEndpoints
{
    public static IEndpointRouteBuilder MapRoleEndpoints(this IEndpointRouteBuilder endpoints)
    {
        var group = endpoints.MapGroup("/api/roles").RequirePermission(PermissionCodes.UserManagement); group.MapGet("", async (bool? includeInactive, RoleService service, CancellationToken ct) => Results.Ok(await service.GetAsync(includeInactive == true, ct))); group.MapPost("", (RoleWriteRequest request, RoleService service, CancellationToken ct) => Save(null, request, service, ct)); group.MapPut("/{id:int}", (int id, RoleWriteRequest request, RoleService service, CancellationToken ct) => Save(id, request, service, ct)); group.MapPost("/{id:int}/activate", (int id, RoleService service, CancellationToken ct) => SetActive(id,true,service,ct)); group.MapPost("/{id:int}/deactivate", (int id, RoleService service, CancellationToken ct) => SetActive(id,false,service,ct)); endpoints.MapGet("/api/permissions", async (RoleService service, CancellationToken ct) => Results.Ok(await service.GetPermissionsAsync(ct))).RequirePermission(PermissionCodes.UserManagement); return endpoints;
    }
    private static async Task<IResult> Save(int? id, RoleWriteRequest request, RoleService service, CancellationToken ct) { try { var result=await service.SaveAsync(id,request,ct); return id.HasValue?Results.Ok(result):Results.Created("/api/roles",result); } catch(RoleException ex){return Results.Problem(ex.Message,statusCode:ex.StatusCode);} }
    private static async Task<IResult> SetActive(int id,bool active,RoleService service,CancellationToken ct){try{return await service.SetActiveAsync(id,active,ct)?Results.NoContent():Results.NotFound();}catch(RoleException ex){return Results.Problem(ex.Message,statusCode:ex.StatusCode);}}
}
