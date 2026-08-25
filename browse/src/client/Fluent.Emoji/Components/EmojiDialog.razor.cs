// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

namespace Fluent.Emoji.Components;

public sealed partial class EmojiDialog
{
    private bool Loading { get; set; } = true;

    private const string LoadingJson = """
        {
          "loading": true,
          "message": "Loading metadata.json, please wait..."
        }
        """;

    private string Json { get; set; } = "";

    [CascadingParameter] public required MudDialogInstance MudDialog { get; set; }

    [Parameter, EditorRequired] public required string MetadataUrl { get; set; }

    [Inject] public required HttpClient Http { get; set; }

    [Inject] public required IJSRuntime JS { get; set; }

    protected override async Task OnInitializedAsync()
    {
        try
        {
            await JS.InvokeVoidAsync("highlight");
            Json = await Http.GetStringAsync(MetadataUrl);
        }
        catch (Exception ex)
        {
            Json = $$"""
                {
                  "loading": false,
                  "message": "Failed to load metadata.json, please try again later.",
                  "error": "{{ex.Message}}"
                }
                """;
        }
        finally
        {
            Loading = false;

            await InvokeAsync(StateHasChanged);
            await JS.InvokeVoidAsync("highlight");
        }
    }

    private void Ok() => MudDialog.Close(DialogResult.Ok(true));
}
