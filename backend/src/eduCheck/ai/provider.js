// EDU-CHECK — level 2, OPTIONAL: an AI engine to add to the local analysis.
//
// Off by default, and the module works fully without it. To plug one in
// later, set EDU_CHECK_AI_PROVIDER and implement `review` below:
//   - "ollama": an open-source model served locally (http://localhost:11434),
//     e.g. a small Mistral / Llama — only on a machine with enough memory
//     (a 7B model needs ~8 GB of RAM; check the VPS before installing it);
//   - any HTTP provider: its key stays in the backend's environment, never
//     in the app.
//
// Whatever the engine, the homework text must be passed to it as DATA (in a
// clearly delimited field), never concatenated into its instructions: a
// homework may contain "ignore the instructions above…" and must not be
// obeyed. Its answer is an extra opinion shown as such, never a verdict, and
// it never changes the local indices.

function configuredProvider() {
    const name = (process.env.EDU_CHECK_AI_PROVIDER || "").trim().toLowerCase();
    return name && name !== "off" && name !== "none" ? name : null;
}

/**
 * @returns {{ enabled: boolean, name: string|null }}
 */
function providerStatus() {
    const name = configuredProvider();
    return { enabled: false, name, note: name ? `Moteur « ${name} » configuré mais pas encore branché : seule l’analyse locale est utilisée.` : null };
}

/**
 * Placeholder for the optional AI review: returns null (nothing added) until
 * a provider is implemented here.
 * @param {{ text: string, subject?: string, level?: string }} _input
 * @returns {Promise<null>}
 */
async function review(_input) {
    return null;
}

module.exports = { providerStatus, review };
