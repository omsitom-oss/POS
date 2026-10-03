using ElitePos.LocalService.Models;
using ElitePos.LocalService.Services;
using Microsoft.Data.SqlClient;

namespace ElitePos.LocalService.Endpoints;

public static class ManagementEndpoints
{
    public static IEndpointRouteBuilder MapManagementEndpoints(this IEndpointRouteBuilder endpoints)
    {
        var management = endpoints.MapGroup("/api/management");
        management.MapGet("/health", async (ManagementService service, CancellationToken cancellationToken) =>
        {
            try
            {
                var connected = await service.CheckHealthAsync(cancellationToken);
                return connected
                    ? Results.Ok(new { connected = true, database = "POSManagement" })
                    : Results.Problem("Management database identity check failed.", statusCode: StatusCodes.Status503ServiceUnavailable);
            }
            catch
            {
                return Results.Problem("Management database is unavailable. Check the local service configuration.", statusCode: StatusCodes.Status503ServiceUnavailable);
            }
        });

        management.MapGet("/business-types", async (ManagementService service, CancellationToken cancellationToken) =>
            Results.Ok(await service.GetBusinessTypesAsync(cancellationToken)));

        management.MapGet("/customers", async (ManagementService service, CancellationToken cancellationToken) =>
            Results.Ok(await service.GetCustomersAsync(cancellationToken)));

        management.MapGet("/customers/{publicId:guid}", async (Guid publicId, ManagementService service, CancellationToken cancellationToken) =>
        {
            var customer = await service.GetCustomerAsync(publicId, cancellationToken);
            return customer is null ? Results.NotFound() : Results.Ok(customer);
        });

        management.MapPost("/customers", async (CreateCustomerRequest request, ManagementService service, ILoggerFactory loggerFactory, CancellationToken cancellationToken) =>
        {
            try
            {
                return Results.Created("/api/management/customers", await service.CreateCustomerAsync(request, cancellationToken));
            }
            catch (ArgumentException exception)
            {
                return Results.ValidationProblem(new Dictionary<string, string[]> { ["customer"] = [exception.Message] });
            }
            catch (SqlException exception) when (exception.Number is 2601 or 2627)
            {
                loggerFactory.CreateLogger("ManagementCustomers").LogWarning("A Management customer create operation hit a uniqueness constraint.");
                return Results.Conflict(new { message = "A unique customer identifier could not be assigned. Please retry." });
            }
        });

        return endpoints;
    }
}
