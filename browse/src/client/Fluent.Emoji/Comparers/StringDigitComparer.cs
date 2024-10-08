// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

namespace Fluent.Emoji.Comparers;

public partial class StringDigitComparer : IComparer<string>
{
    public static StringDigitComparer Instance { get; } = new();

    public int Compare(string? x, string? y)
    {
        if (x is null && y is null)
        {
            return 0;
        }

        if (x is null)
        {
            return -1;
        }

        if (y is null)
        {
            return 1;
        }

        var regex = DigitRegex();

        var xRegexResult = regex.Match(x);
        var yRegexResult = regex.Match(y);

        if (xRegexResult.Success && yRegexResult.Success)
        {
            var xDbl = double.Parse(xRegexResult.Groups[1].Value);
            var yDbl = double.Parse(yRegexResult.Groups[1].Value);

            return xDbl.CompareTo(yDbl);
        }

        return x.CompareTo(y);
    }

    [GeneratedRegex(@"(\d*\.?\d+)")]
    private static partial Regex DigitRegex();
}