export class Res {
  public static error(
    message: string,
    status: number = 500,
    headers: Record<string, string> = {}
  ) {
    return new Response(
      JSON.stringify({
        message,
        success: false,
      }),
      {
        status,
        headers: {
          "Content-Type": "application/json",
          ...headers,
        },
      }
    );
  }

  public static ok(
    message: string,
    status: number = 200,
    headers: Record<string, string> = {}
  ) {
    return new Response(
      JSON.stringify({
        message,
        success: true,
      }),
      {
        status,
        headers: {
          "Content-Type": "application/json",
          ...headers,
        },
      }
    );
  }
}
