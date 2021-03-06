'use strict'

const APIError = require('../server/api_error'),
    Constants = require('../constants')

class BaseController {
    constructor(models, config, components, server) {
        this.models = models
        this.config = config
        this.components = components

        // TODO: update child classes constructor calls and remove server unset check
        if (server) {
            this.handleRESTAsync = server.handleRESTAsync
            this.handleAsync = server.handleAsync
            this.sendResponse = server.sendResponse
        }
    }

    /**
     * Validate body against rules
     * @param {Object.<string, string>} rules
     * @param {*} body Request Body
     */
    validate(rules, body) {
        for (let field in rules) {
            // If field is a custom or inherited property, continue
            if (!rules.hasOwnProperty(field)) {
                continue
            }
            let fieldRules = rules[field].split('|')
            for (let i in fieldRules) {
                let val = body[field]
                let rule = fieldRules[i].toLowerCase()
                if (rule === 'required') {
                    if (!val || val.length <= 0) {
                        throw new APIError(Constants.RESPONSE_ERROR_BAD_REQUEST, `${field} is required`)
                    }
                } else if (rule.startsWith('in:')) {
                    // ignore if empty
                    if (val && val.length > 0) {
                        let values = rule.split(':')[1].split(',')
                        if (values.indexOf(val.toLowerCase()) < 0) {
                            throw new APIError(Constants.RESPONSE_ERROR_BAD_REQUEST, `${field} must be in: ${values}`)
                        }
                    }
                }
            }
        }
        return null
    }

    /**
     * Validate app credentials
     * @param {*} appId
     * @param {*} appSecret
     * @param {*} app
     */
    async validateAppCredentials(appId, appSecret, app) {
        if (!app) {
            app = await this.models.App.findByPk(appId)
        }
        if (!app || app.id !== appId) {
            throw new Error(`Invalid app ID: ${appId}`)
        }
        if (app.secret !== appSecret) {
            throw new Error(`Invalid secret: ${appSecret}`)
        }
        return app
    }

    /**
     * Validate app user credentials and return user object
     * @param {*} hash
     * @param {*} appId
     * @param {*} appSecret
     */
    async validateAppUserCredentials(hash, appId, appSecret) {
        // validate login hash
        let appUser = await this.models.AppUser.findOne({
            where: {hash: hash},
            include: [{all: true}],
        })
        if (!appUser) {
            throw new Error(`Invalid login hash`)
        }
        // validate app credentials
        this.validateAppCredentials(appId, appSecret, appUser.app)
        return appUser
    }
}

module.exports = BaseController