using ElitePos.LocalService.Models;
using ElitePos.LocalService.Services;

namespace ElitePos.LocalService.Endpoints;

public static class LocationEndpoints
{
    public static IEndpointRouteBuilder MapLocationEndpoints(this IEndpointRouteBuilder endpoints)
    {
        var group = endpoints.MapGroup("/api/locations");
        group.MapGet("/countries", async (bool? includeInactive, LocationService service, CancellationToken ct) => Results.Ok(await service.GetCountriesAsync(includeInactive == true, ct)));
        group.MapGet("/countries/{countryId:int}/cities", async (int countryId, bool? includeInactive, LocationService service, CancellationToken ct) => Results.Ok(await service.GetCitiesAsync(countryId, includeInactive == true, ct)));
        group.MapPost("/countries", async (LocationWriteRequest request, LocationService service, CancellationToken ct) => { try { return Results.Created("/api/locations/countries", await service.CreateCountryAsync(request, ct)); } catch (LocationException ex) { return Results.Problem(ex.Message, statusCode: ex.StatusCode); } });
        group.MapPost("/countries/{countryId:int}/cities", async (int countryId, LocationWriteRequest request, LocationService service, CancellationToken ct) => { try { return Results.Created($"/api/locations/countries/{countryId}/cities", await service.CreateCityAsync(countryId, request, ct)); } catch (LocationException ex) { return Results.Problem(ex.Message, statusCode: ex.StatusCode); } });
        group.MapPut("/countries/{countryId:int}", async (int countryId, LocationWriteRequest request, LocationService service, CancellationToken ct) => { try { var result = await service.UpdateCountryAsync(countryId, request, ct); return result is null ? Results.NotFound() : Results.Ok(result); } catch (LocationException ex) { return Results.Problem(ex.Message, statusCode: ex.StatusCode); } });
        group.MapPut("/cities/{cityId:int}", async (int cityId, LocationWriteRequest request, LocationService service, CancellationToken ct) => { try { var result = await service.UpdateCityAsync(cityId, request, ct); return result is null ? Results.NotFound() : Results.Ok(result); } catch (LocationException ex) { return Results.Problem(ex.Message, statusCode: ex.StatusCode); } });
        return endpoints;
    }
}
