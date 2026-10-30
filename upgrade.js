// Each script runs once per connection, when it moves to the version of the module that added it
export const upgradeScripts = [
	// 1.1.0: login and message logging became settings. Fill them in with what version 1.0 used
	function (_context, props) {
		const config = props.config
		if (!config || config.username !== undefined) {
			return { updatedConfig: null, updatedActions: [], updatedFeedbacks: [] }
		}
		return {
			updatedConfig: { ...config, username: 'streamDeck', password: 'streamDeck', debug_messages: false },
			updatedActions: [],
			updatedFeedbacks: [],
		}
	},
]
