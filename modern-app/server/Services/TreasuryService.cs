using System.Data;
using System.Data.Common;
using ElitePos.LocalService.Data;
using ElitePos.LocalService.Models;

namespace ElitePos.LocalService.Services;

public sealed class TreasuryService(DbConnectionFactory factory)
{
    public async Task<IReadOnlyList<TreasuryDto>> GetAsync(bool includeInactive, CancellationToken ct)
    {
        await using var db = await OpenAsync(ct); await using var cmd = db.CreateCommand();
        cmd.CommandText = "SELECT b.TreasuryId,b.TreasuryCode,b.NameAr,b.NameEn,b.TreasureType,b.BankId,k.NameAr,k.NameEn,b.AccountNumber,b.CurrencyId,c.Symbol,c.CurrencyCode,b.IsActive,b.SortOrder,b.CreatedAt,b.UpdatedAt FROM dbo.Treasuries b JOIN dbo.Currencies c ON c.CurrencyId=b.CurrencyId LEFT JOIN dbo.Banks k ON k.BankId=b.BankId WHERE (@inactive=1 OR b.IsActive=1) ORDER BY b.SortOrder,b.NameEn";
        Add(cmd, "@inactive", includeInactive, DbType.Boolean); await using var reader = await cmd.ExecuteReaderAsync(ct);
        var rows = new List<TreasuryDto>(); while (await reader.ReadAsync(ct)) rows.Add(new(reader.GetInt32(0), reader.GetString(1), reader.GetString(2), reader.GetString(3), reader.GetString(4), reader.IsDBNull(5)?null:reader.GetInt32(5), reader.IsDBNull(6)?null:reader.GetString(6), reader.IsDBNull(7)?null:reader.GetString(7), reader.IsDBNull(8)?null:reader.GetString(8), reader.GetInt32(9), reader.GetString(10), reader.GetString(11), reader.GetBoolean(12), reader.GetInt32(13), reader.GetDateTime(14), reader.GetDateTime(15))); return rows;
    }
    public async Task<TreasuryDto> SaveAsync(int? id, TreasuryWriteRequest request, CancellationToken ct)
    {
        Validate(request); await using var db = await OpenAsync(ct); await using var tx = await db.BeginTransactionAsync(IsolationLevel.Serializable, ct);
        try
        {
            await using (var currency = db.CreateCommand()) { currency.Transaction = tx; currency.CommandText = "SELECT IsActive FROM dbo.Currencies WHERE CurrencyId=@id"; Add(currency, "@id", request.CurrencyId, DbType.Int32); var active = await currency.ExecuteScalarAsync(ct); if (active is null) throw new TreasuryException("Currency was not found.", 404); if (!Convert.ToBoolean(active)) throw new TreasuryException("Choose an active currency."); }
            if (request.TreasureType == "BANK") { await using var bank = db.CreateCommand(); bank.Transaction = tx; bank.CommandText = "SELECT IsActive FROM dbo.Banks WHERE BankId=@id"; Add(bank, "@id", request.BankId, DbType.Int32); var bankActive = await bank.ExecuteScalarAsync(ct); if (bankActive is null) throw new TreasuryException("Bank was not found.", 404); if (!Convert.ToBoolean(bankActive)) throw new TreasuryException("Choose an active bank."); }
            int treasuryId;
            if (id.HasValue)
            {
                await using var update = db.CreateCommand(); update.Transaction = tx; update.CommandText = "UPDATE dbo.Treasuries SET NameAr=@ar,NameEn=@en,TreasureType=@type,BankId=@bank,AccountNumber=@account,CurrencyId=@currency,IsActive=@active,UpdatedAt=SYSUTCDATETIME() WHERE TreasuryId=@id"; Add(update,"@ar",request.NameAr!.Trim(),DbType.String,150); Add(update,"@en",request.NameEn!.Trim(),DbType.String,150); Add(update,"@type",request.TreasureType,DbType.String,10); Add(update,"@bank",request.BankId,DbType.Int32); Add(update,"@account",request.AccountNumber?.Trim(),DbType.String,100); Add(update,"@currency",request.CurrencyId,DbType.Int32); Add(update,"@active",request.IsActive,DbType.Boolean); Add(update,"@id",id.Value,DbType.Int32); if (await update.ExecuteNonQueryAsync(ct)==0) throw new TreasuryException("Treasury was not found.",404); treasuryId=id.Value;
            }
            else
            {
                await using var next = db.CreateCommand(); next.Transaction=tx; next.CommandText="SELECT ISNULL(MAX(SortOrder),0)+1 FROM dbo.Treasuries WITH (TABLOCKX,HOLDLOCK)"; var sort=Convert.ToInt32(await next.ExecuteScalarAsync(ct));
                await using var insert=db.CreateCommand(); insert.Transaction=tx; insert.CommandText="INSERT INTO dbo.Treasuries(TreasuryCode,NameAr,NameEn,TreasureType,BankId,AccountNumber,CurrencyId,IsActive,SortOrder,BranchId) OUTPUT INSERTED.TreasuryId VALUES(@code,@ar,@en,@type,@bank,@account,@currency,@active,@sort,(SELECT TOP 1 BranchId FROM dbo.Branches ORDER BY BranchId))"; Add(insert,"@code",$"P-{Guid.NewGuid():N}"[..18],DbType.String,24); Add(insert,"@ar",request.NameAr!.Trim(),DbType.String,150); Add(insert,"@en",request.NameEn!.Trim(),DbType.String,150); Add(insert,"@type",request.TreasureType,DbType.String,10); Add(insert,"@bank",request.BankId,DbType.Int32); Add(insert,"@account",request.AccountNumber?.Trim(),DbType.String,100); Add(insert,"@currency",request.CurrencyId,DbType.Int32); Add(insert,"@active",request.IsActive,DbType.Boolean); Add(insert,"@sort",sort,DbType.Int32); treasuryId=Convert.ToInt32(await insert.ExecuteScalarAsync(ct));
                await using var code=db.CreateCommand(); code.Transaction=tx; code.CommandText="UPDATE dbo.Treasuries SET TreasuryCode=@code,UpdatedAt=SYSUTCDATETIME() WHERE TreasuryId=@id"; Add(code,"@code",$"TR-{treasuryId:D6}",DbType.String,24); Add(code,"@id",treasuryId,DbType.Int32); await code.ExecuteNonQueryAsync(ct);
            }
            await tx.CommitAsync(ct); return (await GetAsync(true,ct)).First(x=>x.TreasuryId==treasuryId);
        } catch { await tx.RollbackAsync(ct); throw; }
    }
    public async Task<bool> SetActiveAsync(int id,bool active,CancellationToken ct){await using var db=await OpenAsync(ct);await using var cmd=db.CreateCommand();cmd.CommandText="UPDATE dbo.Treasuries SET IsActive=@active,UpdatedAt=SYSUTCDATETIME() WHERE TreasuryId=@id";Add(cmd,"@active",active,DbType.Boolean);Add(cmd,"@id",id,DbType.Int32);return await cmd.ExecuteNonQueryAsync(ct)>0;}
    private static void Validate(TreasuryWriteRequest r){if(string.IsNullOrWhiteSpace(r.NameAr)||string.IsNullOrWhiteSpace(r.NameEn))throw new TreasuryException("Arabic and English treasure names are required.");if(r.NameAr.Trim().Length>150||r.NameEn.Trim().Length>150)throw new TreasuryException("Treasure names must be 150 characters or fewer.");if(r.CurrencyId<=0)throw new TreasuryException("Choose a currency.");if(r.TreasureType is not ("CASH" or "BANK"))throw new TreasuryException("Choose cash or bank account.");if(r.TreasureType=="BANK"&&(r.BankId is null))throw new TreasuryException("Bank is required for bank treasures.");if(r.TreasureType=="CASH"&&(r.BankId is not null||!string.IsNullOrWhiteSpace(r.AccountNumber)))throw new TreasuryException("Cash treasures cannot have bank details.");if(r.AccountNumber?.Trim().Length>100)throw new TreasuryException("Account number must be 100 characters or fewer.");}
    private async Task<DbConnection> OpenAsync(CancellationToken ct){var db=factory.CreateConnection();await db.OpenAsync(ct);return db;}
    private static void Add(DbCommand c,string n,object? v,DbType t,int? size=null){var p=c.CreateParameter();p.ParameterName=n;p.DbType=t;if(size.HasValue)p.Size=size.Value;p.Value=v??DBNull.Value;c.Parameters.Add(p);}
}
public sealed class TreasuryException(string message,int statusCode=400):Exception(message){public int StatusCode{get;}=statusCode;}

