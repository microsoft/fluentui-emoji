var builder = WebAssemblyHostBuilder.CreateDefault(args);
builder.RootComponents.Add<App>("#app");
builder.RootComponents.Add<HeadOutlet>("head::after");

builder.Services.AddMudServices();
builder.Services.AddMemoryCache();
builder.Services.AddLocalStorageServices();
builder.Services.AddSessionStorageServices();
builder.Services.AddScoped<EmojiService>();
builder.Services.AddHttpClient<EmojiService>(
    client =>
    client.BaseAddress = new Uri(builder.HostEnvironment.BaseAddress));

await builder.Build().RunAsync();
