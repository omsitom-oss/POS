namespace ElitePos.LocalService.Services;

// How much a return refunds. The invoice discount is shared across its lines in proportion to their value,
// so returning part of a discounted invoice refunds the discounted amount, not the gross price.
public static class ReturnMath
{
    // gross: value of the returned lines at invoice prices. completesInvoice: after this return nothing is left to return,
    // in which case the refund is whatever of the invoice total has not been refunded yet, so rounding never leaves a remainder.
    public static decimal NetRefund(decimal gross, decimal invoiceSubtotal, decimal invoiceDiscount, decimal invoiceTotal, decimal alreadyRefunded, bool completesInvoice)
    {
        var remaining = Math.Max(0, invoiceTotal - alreadyRefunded);
        if (completesInvoice) return remaining;
        var share = invoiceSubtotal <= 0 ? 0 : invoiceDiscount * gross / invoiceSubtotal;
        var net = Math.Round(gross - share, 2, MidpointRounding.AwayFromZero);
        return Math.Clamp(net, 0, remaining);
    }
}
