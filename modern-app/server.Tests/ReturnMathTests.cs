using ElitePos.LocalService.Services;

namespace ElitePos.LocalService.Tests;

public sealed class ReturnMathTests
{
    [Fact]
    public void A_partial_return_carries_its_share_of_the_invoice_discount()
    {
        // Invoice 62 less 2 discount; returning 16 of it refunds 16 - 2 * 16 / 62.
        Assert.Equal(15.48m, ReturnMath.NetRefund(16m, 62m, 2m, 60m, 0m, completesInvoice: false));
    }

    [Fact]
    public void Without_a_discount_the_refund_is_the_gross_amount()
    {
        Assert.Equal(24m, ReturnMath.NetRefund(24m, 100m, 0m, 100m, 0m, completesInvoice: false));
    }

    [Fact]
    public void The_return_that_completes_an_invoice_refunds_whatever_is_left()
    {
        // Three returns of a third each: rounding the first two must not leave a cent behind or refund one too many.
        var first = ReturnMath.NetRefund(10m, 30m, 1m, 29m, 0m, false);
        var second = ReturnMath.NetRefund(10m, 30m, 1m, 29m, first, false);
        var last = ReturnMath.NetRefund(10m, 30m, 1m, 29m, first + second, true);
        Assert.Equal(29m, first + second + last);
    }

    [Fact]
    public void A_refund_never_exceeds_what_is_left_of_the_invoice()
    {
        Assert.Equal(5m, ReturnMath.NetRefund(20m, 100m, 0m, 100m, 95m, completesInvoice: false));
        Assert.Equal(0m, ReturnMath.NetRefund(20m, 100m, 0m, 100m, 120m, completesInvoice: true));
    }
}
