using System.Data;
using System.Data.Common;
using ElitePos.LocalService.Data;
using ElitePos.LocalService.Models;

namespace ElitePos.LocalService.Services;

public sealed class BankService(DbConnectionFactory factory)
{
    public async Task<IReadOnlyList<BankDto>> GetAsync(bool includeInactive, CancellationToken ct)
    {
        await using var db = await OpenAsync(ct); await using var cmd = db.CreateCommand();
        cmd.CommandText = "SELECT BankId,BankCode,NameAr,NameEn,IsActive,SortOrder,CreatedAt,UpdatedAt FROM dbo.Banks WHERE (@inactive=1 OR IsActive=1) ORDER BY SortOrder,NameEn";
        Add(cmd,"@inactive",includeInactive,DbType.Boolean); await using var reader=await cmd.ExecuteReaderAsync(ct); var rows=new List<BankDto>(); while(await reader.ReadAsync(ct)) rows.Add(Read(reader)); return rows;
    }
    public async Task<BankDto> SaveAsync(int? id, BankWriteRequest request, CancellationToken ct)
    {
        Validate(request); await using var db=await OpenAsync(ct); await using var tx=await db.BeginTransactionAsync(IsolationLevel.Serializable,ct);
        try { int bankId; if(id.HasValue){await using var cmd=db.CreateCommand();cmd.Transaction=tx;cmd.CommandText="UPDATE dbo.Banks SET NameAr=@ar,NameEn=@en,IsActive=@active,UpdatedAt=SYSUTCDATETIME() WHERE BankId=@id";Add(cmd,"@ar",request.NameAr!.Trim(),DbType.String,150);Add(cmd,"@en",request.NameEn!.Trim(),DbType.String,150);Add(cmd,"@active",request.IsActive,DbType.Boolean);Add(cmd,"@id",id.Value,DbType.Int32);if(await cmd.ExecuteNonQueryAsync(ct)==0)throw new BankException("Bank was not found.",404);bankId=id.Value;}else{await using var next=db.CreateCommand();next.Transaction=tx;next.CommandText="SELECT ISNULL(MAX(SortOrder),0)+1 FROM dbo.Banks WITH (TABLOCKX,HOLDLOCK)";var sort=Convert.ToInt32(await next.ExecuteScalarAsync(ct));await using var ins=db.CreateCommand();ins.Transaction=tx;ins.CommandText="INSERT INTO dbo.Banks(BankCode,NameAr,NameEn,IsActive,SortOrder) OUTPUT INSERTED.BankId VALUES(@code,@ar,@en,@active,@sort)";Add(ins,"@code",$"P-{Guid.NewGuid():N}"[..18],DbType.String,24);Add(ins,"@ar",request.NameAr!.Trim(),DbType.String,150);Add(ins,"@en",request.NameEn!.Trim(),DbType.String,150);Add(ins,"@active",request.IsActive,DbType.Boolean);Add(ins,"@sort",sort,DbType.Int32);bankId=Convert.ToInt32(await ins.ExecuteScalarAsync(ct));await using var code=db.CreateCommand();code.Transaction=tx;code.CommandText="UPDATE dbo.Banks SET BankCode=@code,UpdatedAt=SYSUTCDATETIME() WHERE BankId=@id";Add(code,"@code",$"BNK-{bankId:D6}",DbType.String,24);Add(code,"@id",bankId,DbType.Int32);await code.ExecuteNonQueryAsync(ct);}await tx.CommitAsync(ct);return(await GetAsync(true,ct)).First(x=>x.BankId==bankId); } catch { await tx.RollbackAsync(ct); throw; }
    }
    public async Task<bool> SetActiveAsync(int id,bool active,CancellationToken ct){await using var db=await OpenAsync(ct);await using var cmd=db.CreateCommand();cmd.CommandText="UPDATE dbo.Banks SET IsActive=@active,UpdatedAt=SYSUTCDATETIME() WHERE BankId=@id";Add(cmd,"@active",active,DbType.Boolean);Add(cmd,"@id",id,DbType.Int32);return await cmd.ExecuteNonQueryAsync(ct)>0;}
    private static BankDto Read(DbDataReader r)=>new(r.GetInt32(0),r.GetString(1),r.GetString(2),r.GetString(3),r.GetBoolean(4),r.GetInt32(5),r.GetDateTime(6),r.GetDateTime(7));
    private static void Validate(BankWriteRequest r){if(string.IsNullOrWhiteSpace(r.NameAr)||string.IsNullOrWhiteSpace(r.NameEn))throw new BankException("Arabic and English bank names are required.");if(r.NameAr.Trim().Length>150||r.NameEn.Trim().Length>150)throw new BankException("Bank names must be 150 characters or fewer.");}
    private async Task<DbConnection> OpenAsync(CancellationToken ct){var db=factory.CreateConnection();await db.OpenAsync(ct);return db;}
    private static void Add(DbCommand c,string n,object? v,DbType t,int? size=null){var p=c.CreateParameter();p.ParameterName=n;p.DbType=t;if(size.HasValue)p.Size=size.Value;p.Value=v??DBNull.Value;c.Parameters.Add(p);}
}
public sealed class BankException(string message,int statusCode=400):Exception(message){public int StatusCode{get;}=statusCode;}
