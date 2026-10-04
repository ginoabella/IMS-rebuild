for (const name of ['live', 'ready']) {
  try {
    const response = await fetch(`http://backend:4000/health/${name}`, {
      signal: AbortSignal.timeout(5000),
    });
    console.log(
      JSON.stringify({
        endpoint: name,
        httpStatus: response.status,
        ...(await response.json()),
      }),
    );
    if (!response.ok) process.exitCode = 1;
  } catch {
    console.error(`${name}: backend is unavailable`);
    process.exitCode = 1;
  }
}
