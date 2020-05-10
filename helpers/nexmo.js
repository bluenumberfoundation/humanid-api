'use strict'

const
    logger = require('../logger').child({scope: 'Core.Components.Vonage'}),
    request = require('request'),
    models = require('../models/index'),
    helpers = require('./common'),
    config = helpers.config,
    {Verification: VerificationModel} = models

// create random verification code and send SMS
const sendVerificationSMS = async (countryCode, phone, testVerificationCode) => {    
    if (config.NEXMO_REST_URL && config.NEXMO_API_KEY && config.NEXMO_API_SECRET) {        
        let number = helpers.combinePhone(countryCode, phone)
        let verification = await VerificationModel.findOne({where: {number: number}})
        let resend = true
        if (verification && verification.requestId) {
            let lastUpdate = new Date() - verification.updatedAt	
            resend = lastUpdate >= config.OTP_EXPIRY_MS            
        }
        if (!resend) {
            // just return object
            return Promise.resolve(verification)
        } else {
            let verificationCode = testVerificationCode || helpers.randStr(4, 1)
            if (!verification) {
                // create new
                verification = await VerificationModel.create({number: number, requestId: verificationCode})
            } else {
                // update code
                verification.requestId = verificationCode
                await verification.save()
            }
            let options = {
                method: 'post',
                url: `${config.NEXMO_REST_URL}/sms/json`,
                form: {
                    from: config.NEXMO_FROM,
                    text: `Your humanID verification code is ${verificationCode}`,
                    to: number,
                    api_key: config.NEXMO_API_KEY,
                    api_secret: config.NEXMO_API_SECRET,
                },
                json: true,
            }
    
            // send OTP
            return new Promise((resolve, reject) => {
                request(options, (error, res, body) => {
                    if (error) {
                        logger.error(error)
                        reject(error)
                    } else {
                        if (body.messages && body.messages.length === 1 && body.messages[0].status === '0') {
                            resolve(verification)
                        } else {
                            logger.error(body)
                            reject(body)
                        }  
                    }
                })  
            })
        }
    } else {
        return Promise.resolve('TEST_CODE')
    }
}

// compare verificationCode with database entry
const checkVerificationSMS = async (countryCode, phone, verificationCode) => {
    if (config.NEXMO_REST_URL && config.NEXMO_API_KEY && config.NEXMO_API_SECRET) {
        let number = helpers.combinePhone(countryCode, phone)
        let count = await VerificationModel.destroy({where: {number: number, requestId: verificationCode}})
        if (count === 1) {
            return Promise.resolve(1)
        } else {
            return Promise.reject({name: 'ValidationError', message: 'Invalid verification code'})
        }
    } else {
        return Promise.resolve(1)
    }
}


const requestPhoneVerification = async (countryCode, phone) => {
    if (config.NEXMO_API_URL && config.NEXMO_API_KEY && config.NEXMO_API_SECRET) {
        let number = helpers.combinePhone(countryCode, phone)
        let options = {
            method: 'get',
            url: `${config.NEXMO_API_URL}/verify/json`,
            qs: {
                api_key: config.NEXMO_API_KEY,
                api_secret: config.NEXMO_API_SECRET,
                number: number,
                brand: 'humanID',
                code_length: 4,
            },
            json: true,
        }
        return new Promise((resolve, reject) => {
            request(options, (error, res, body) => {
                // console.log(body)
                if (error) {
                    reject(error)
                } else {
                    if (body.status === '0' && body.request_id) {
                        resolve(body.request_id)
                    } else {
                        logger.error(body)
                        resolve(body['error_text'])
                    }
                }
            })  
        })
            .then((requestId) => {
                return VerificationModel.create({
                    number: number,
                    requestId: requestId,
                })
            })
    } else {
        // mock up for demo
        return Promise.resolve('TEST_REQUEST_ID')
    }
}

// check verification code
const checkVerificationCode = async (countryCode, phone, verificationCode) => {
    if (config.NEXMO_API_URL && config.NEXMO_API_KEY && config.NEXMO_API_SECRET) {
        let number = helpers.combinePhone(countryCode, phone)
        let verification = await VerificationModel.findByPk(number)
        if (!verification) {
            return Promise.reject({name: 'SequelizeValidationError', message: `No pending verification for (${countryCode}) ${phone}`})
        }
        let options = {
            method: 'get',
            url: `${config.NEXMO_API_URL}/verify/check/json`,
            qs: {
                api_key: config.NEXMO_API_KEY, 
                api_secret: config.NEXMO_API_SECRET, 
                request_id: verification.requestId, 
                code: verificationCode,
            },
            json: true,
        }
        return new Promise((resolve, reject) => {
            request(options, (error, res, body) => {
                if (error) {
                    reject(error)
                } else {
                    if (body.status === '0' && body.request_id) {
                        resolve(body.request_id)
                    } else {
                        logger.error(body)
                        resolve(body['error_text'])
                    }
                }
            })  
        })
            .then(() => {
                // delete verification record
                return VerificationModel.destroy({where: {number: number}})
            })
    } else {
        // mock up for demo
        return Promise.resolve(1)        
    }
}

module.exports = {
    requestPhoneVerification: requestPhoneVerification,
    checkVerificationCode: checkVerificationCode,
    sendVerificationSMS: sendVerificationSMS,
    checkVerificationSMS: checkVerificationSMS,
}
