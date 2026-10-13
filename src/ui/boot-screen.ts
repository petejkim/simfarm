/** The title-screen boot overlay (#boot) lives in index.html so it shows before the app loads (user request). The app
 * removes it once the farm, or a startup error, is ready to be seen. */
export function dismissBootScreen(): void { document.getElementById('boot')?.remove(); }
