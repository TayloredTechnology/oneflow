#!/usr/bin/env node
const pinoDebug = require('pino-debug')

global.log = require('pino')(
	{level: process.env.LEVEL || 'info'},
	process.stdout
)
pinoDebug(global.log, {auto: true, map: {'*': 'debug'}})

// Global Functions
const conventionalRecommendedBump = require(`conventional-recommended-bump`)

global.getConventionalRecommendedBump = preset =>
	new Promise((resolve, reject) => {
		conventionalRecommendedBump(
			{
				preset
			},
			function(err, result) {
				if (err) return reject(err)
				resolve(result.releaseType)
			}
		)
	})

global.sp = require('ora')()

const co = require('co')

global.isCleanWorkDir = co.wrap(function*(git) {
	global.sp.start('ensure working directory is clean…')
	const status = yield git.status()
	const dirStatus = (({conflicted, created, deleted, modified, renamed}) => ({
		conflicted,
		created,
		deleted,
		modified,
		renamed
	}))(status)
	const dirCheckOk = Object.keys(dirStatus).map(item => {
		return dirStatus[item].length > 0
	})
	const dirOk = !dirCheckOk.includes(true)
	if (!dirOk) {
		global.sp.fail().stop()
		log.error('Working Directory must be clean')
		process.exit()
	}
	global.sp.succeed()
})

const {getInstalledPath} = require('get-installed-path')

global.installedPath = co.wrap(function*() {
	let retVal
	try {
		retVal = yield getInstalledPath('@tayloredtechnology/oneflow', {
			local: false
		})
	} catch (err) {
		retVal = yield getInstalledPath('@tayloredtechnology/oneflow', {
			local: true
		})
	}
	return retVal + '/node_modules/.bin/'
})

const cgh = require('conventional-github-releaser')

global.conventionalGitHubReleaser = (argv, isDraft = false) =>
	new Promise((resolve, reject) => {
		cgh(
			{type: 'oauth', token: argv.token, url: argv.url},
			{preset: 'angular', draft: isDraft},
			function(err, result) {
				if (err) return reject(err)
				resolve(result)
			}
		)
	})

// Catch Promises
process.on('unhandledRejection', (reason, p) => {
	global.sp.stop()
	log.error('Unhandled Rejection at: Promise', p, 'reason:', reason)
	process.exit()
})

// Yargs CLI
require('yargs')
	.commandDir('cmds')
	.env('GITHUB')
	.options({
		token: {
			desc:
				"for releasing, a token of scope 'repo' is needed. Environment Variable GITHUB_TOKEN can be used instead"
		},
		endpoint: {
			desc:
				'GitHub Enterprise Override API endpoint. Environment Variable GITHUB_ENDPOINT can be used instead.',
			default: 'https://api.github.com'
		}
	})
	.demandCommand()
	.help()
	.strict().argv
