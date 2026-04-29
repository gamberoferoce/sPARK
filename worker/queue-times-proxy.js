export default {
  async fetch(request) {
    const url = new URL(request.url);
    const targetPath = url.pathname.replace("/api/queue-times", "");
    const targetUrl = `https://queue-times.com${targetPath}`;

    const response = await fetch(targetUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        Accept: "application/json",
      },
    });

    const data = await response.text();

    return new Response(data, {
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
    });
  },
};

