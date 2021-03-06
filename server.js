'use strict'

/**
 * @typedef {Object} RESTHandlerResult
 * @property {*} data Result data
 * @property {string} code Message code
 * @property {string} message Message
 */

/**
 * Async REST Handler function
 * @async
 * @callback RESTHandlerAsyncFn
 * @param {*} req Express request
 * @returns {RESTHandlerResult}
 */

const
    Constants = require('./constants'),
    express = require('express'),
    bodyParser = require('body-parser'),
    path = require('path'),
    ResponseMapper = require('./components/response-mapper'),
    WebConsoleController = require('./controllers/webconsole'),
    MobileController = require('./controllers/mobile'),
    WebController = require('./controllers/web'),
    APIError = require('./server/api_error')

class Server {
    constructor(models, common, middlewares, nexmo, {logger}) {
        // Set logger
        this.logger = logger

        // Init config
        this.config = common.config

        // Init work dir
        this.workDir = path.resolve('./')

        // Init models
        this.models = models

        // Init components
        ResponseMapper.init({filePath: this.workDir + '/response-codes.json'})
        this.components = {
            common,
            nexmo,
            response: ResponseMapper
        }

        // Init router
        this.initRouter(middlewares)
    }

    initRouter(middlewares) {
        // Init router params
        const routerParams = {
            logger: this.logger,
            components: this.components,
            config: this.config,
            models: this.models,
            server: {
                handleAsync: this.handleAsync,
                handleRESTAsync: this.handleRESTAsync,
                sendResponse: this.sendResponse
            }
        }

        // Get params
        const models = this.models
        const {common, nexmo} = this.components

        // Get base url
        const basePath = this.config.BASE_PATH

        // Init Main Routers
        this.app = express()

        // Configure middlewares
        this.app.use(bodyParser.json())
        this.app.use(bodyParser.urlencoded({extended: true}))

        // Configure routing
        this.app.use(`${basePath}/`, express.static('doc'))
        this.app.use(`${basePath}/lib`, express.static('client/dist'))
        this.app.use(`${basePath}/examples`, express.static('examples'))
        this.app.use(`${basePath}/console`, new WebConsoleController(models, common, middlewares).router)
        this.app.use(`${basePath}/mobile`, new MobileController(routerParams).router)
        this.app.use(`${basePath}/web`, new WebController(models, common, nexmo).router)

        // Handle Errors
        this.app.use((req, res) => {
            this.sendErrorResponse(res, new APIError(Constants.RESPONSE_ERROR_NOT_FOUND))
        })

        // Handle Resource Not Found
        this.app.use((err, req, res) => {
            this.sendErrorResponse(res, err)
        })
    }

    /**
     * Send success response
     *
     * @param res {*} Express response object
     * @param opt {object} Options
     * @param opt.message {string} Message to override
     * @param opt.data {*} Data
     * @param opt.code {string} Response code
     */
    sendResponse = (res, opt = {}) => {
        // Get response component
        const {response: responseMapper} = this.components

        // Deconstruct options
        const {code, message, data} = opt

        /** @type {Response} */
        let resp

        if (code) {
            // If code is set, get response code
            resp = responseMapper.get(code, {success: true})
        } else {
            // Else, get a generic success
            resp = responseMapper.getSuccess()
        }

        // Compose response
        const body = resp.compose({message, data})

        // Send response
        res.json(body)
    }

    /**
     * Send error response
     *
     * @param res {*} Express response
     * @param err {APIError|Error} Error
     */
    sendErrorResponse = (res, err) => {
        // Get response component
        const {response: responseMapper} = this.components

        /** @type Response */
        let resp
        /** @type any */
        let data

        // If error is not APIError, convert to Internal Error
        if (err.constructor.name !== "APIError") {
            resp = responseMapper.getInternalError()

            // If debug mode, add source error stack
            if (this.config.APP_DEBUG) {
                data = {
                    _errorDebug: {
                        name: err.name,
                        message: err.message,
                        stack: err.stack
                    }
                }
            }

            this.logger.error(err.stack, {scope: 'Server'})
        } else {
            resp = responseMapper.get(err.code)
        }

        // Compose body
        const body = resp.compose({data, message: err.message})

        // Send response
        res
            .status(resp.status)
            .json(body)
    }

    /**
     * Wraps a Promised-based handler function and returns an express handler
     *
     * @param handlerFn
     * @returns {function(...[*]=)}
     */
    handleAsync = handlerFn => {
        // Create function
        return async (req, res, next) => {
            try {
                await handlerFn(req, res, next)
            } catch (err) {
                this.sendErrorResponse(res, err)
            }
        }
    }

    /**
     * Wraps a Async REST Handler function, receive result and send response
     *
     * @param {RESTHandlerAsyncFn} handlerFn
     * @returns {function(...[*]=)} Express handler function
     */
    handleRESTAsync = handlerFn => {
        // Create function
        return async (req, res) => {
            try {
                const result = await handlerFn(req)
                this.sendResponse(res, result)
            } catch (err) {
                this.sendErrorResponse(res, err)
            }
        }
    }
}

module.exports = Server