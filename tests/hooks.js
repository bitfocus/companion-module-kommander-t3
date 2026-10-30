// Module hooks for the tests: @companion-module/base and ws load the stand-ins in ./mocks
const mocks = {
	'@companion-module/base': new URL('./mocks/base.js', import.meta.url).href,
	ws: new URL('./mocks/ws.js', import.meta.url).href,
}

export async function resolve(specifier, context, nextResolve) {
	return mocks[specifier] ? { url: mocks[specifier], shortCircuit: true } : nextResolve(specifier, context)
}
