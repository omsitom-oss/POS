using ElitePos.LocalService.Models;
using ElitePos.LocalService.Security;
using ElitePos.LocalService.Services;

namespace ElitePos.LocalService.Endpoints;

public static class SettingsEndpoints
{
    public static IEndpointRouteBuilder MapSettingsEndpoints(this IEndpointRouteBuilder endpoints)
    {
        var group = endpoints.MapGroup("/api/settings").RequireAuthorization(); var write = group.MapGroup("").RequirePermission(PermissionCodes.SettingsManage);
        group.MapGet("/types",async(bool? includeInactive,SettingsService service,CancellationToken ct)=>Results.Ok(await service.GetTypesAsync(ct, includeInactive == true)));
        write.MapPost("/types",async(SettingTypeWriteRequest request,SettingsService service,CancellationToken ct)=>{try{var result=await service.CreateTypeAsync(request,ct);return Results.Created($"/api/settings/types/{result.SettingTypeId}",result);}catch(SettingsException ex){return Results.Problem(ex.Message,statusCode:ex.StatusCode);}catch(Exception ex) when (IsUniqueConflict(ex)){return Results.Conflict(new{error="A generated setting type code already exists. Retry the request."});}});
        write.MapPut("/types/{settingTypeId:int}",async(int settingTypeId,SettingTypeWriteRequest request,SettingsService service,CancellationToken ct)=>{try{var result=await service.UpdateTypeAsync(settingTypeId,request,ct);return result is null?Results.NotFound():Results.Ok(result);}catch(SettingsException ex){return Results.Problem(ex.Message,statusCode:ex.StatusCode);}catch(Exception ex) when (IsUniqueConflict(ex)){return Results.Conflict(new{error="A generated setting type code already exists."});}});
        write.MapPost("/types/{settingTypeId:int}/activate",async(int settingTypeId,SettingsService service,CancellationToken ct)=>await service.SetTypeActiveAsync(settingTypeId,true,ct)?Results.NoContent():Results.NotFound());
        write.MapPost("/types/{settingTypeId:int}/deactivate",async(int settingTypeId,SettingsService service,CancellationToken ct)=>await service.SetTypeActiveAsync(settingTypeId,false,ct)?Results.NoContent():Results.NotFound());
        group.MapGet("/types/{typeCode}",async(string typeCode,SettingsService service,CancellationToken ct)=>{var result=await service.GetTypeAsync(typeCode,ct);return result is null?Results.NotFound():Results.Ok(result);});
        group.MapGet("/types/{typeCode}/items",async(string typeCode,string? search,bool? active,int? parent,bool? roots,SettingsService service,CancellationToken ct)=>{var result=await service.GetItemsAsync(typeCode,search,active,parent,roots==true,ct);return result is null?Results.NotFound():Results.Ok(result);});
        group.MapGet("/types/{typeCode}/tree",async(string typeCode,SettingsService service,CancellationToken ct)=>{try{var result=await service.GetTreeAsync(typeCode,ct);return result is null?Results.NotFound():Results.Ok(result);}catch(SettingsException ex){return Results.Problem(ex.Message,statusCode:ex.StatusCode);}});
        write.MapPost("/types/{typeCode}/items",async(string typeCode,SettingWriteRequest request,SettingsService service,CancellationToken ct)=>{try{var result=await service.CreateAsync(typeCode,request,ct);return result is null?Results.NotFound():Results.Created($"/api/settings/items/{result.SettingId}",result);}catch(SettingsException ex){return Results.Problem(ex.Message,statusCode:ex.StatusCode);}catch(Exception ex) when (IsUniqueConflict(ex)){return Results.Conflict(new{error="Code already exists for this setting type."});}});
        write.MapPut("/items/{settingId:int}",async(int settingId,SettingWriteRequest request,SettingsService service,CancellationToken ct)=>{try{var result=await service.UpdateAsync(settingId,request,ct);return result is null?Results.NotFound():Results.Ok(result);}catch(SettingsException ex){return Results.Problem(ex.Message,statusCode:ex.StatusCode);}catch(Exception ex) when(IsUniqueConflict(ex)){return Results.Conflict(new{error="Code already exists for this setting type."});}});
        write.MapPost("/items/{settingId:int}/activate",async(int settingId,SettingsService service,CancellationToken ct)=>{try{return await service.SetActiveAsync(settingId,true,ct)?Results.NoContent():Results.NotFound();}catch(SettingsException ex){return Results.Problem(ex.Message,statusCode:ex.StatusCode);}});
        write.MapPost("/items/{settingId:int}/deactivate",async(int settingId,SettingsService service,CancellationToken ct)=>{try{return await service.SetActiveAsync(settingId,false,ct)?Results.NoContent():Results.NotFound();}catch(SettingsException ex){return Results.Problem(ex.Message,statusCode:ex.StatusCode);}});
        return endpoints;
    }
    private static bool IsUniqueConflict(Exception ex)=>ex.ToString().Contains("2601",StringComparison.Ordinal)||ex.ToString().Contains("2627",StringComparison.Ordinal);
}
