'use strict'

const bcrypt = require('bcryptjs')

module.exports = {
    up: async queryInterface => {
        const transaction = await queryInterface.sequelize.transaction()
        let now = new Date()
        try {
            let admin1 = {
                email: 'admin@local.host',
                password: bcrypt.hashSync('admin123'),
                createdAt: now,
                updatedAt: now,
            }
            let app1 = {
                id: 'DEMO_APP',
                platform: 'ANDROID',
                secret: '2ee4300fd136ed6796a6a507de7c1f49aecd4a11663352fe54e54403c32bd6a0',
                serverKey: 'AAAAVoBmFpE:APA91bGceqqtJx54wDWbxuTO2fgd7hWA7olWYBwNZvZ4Hyt2-IzDJv1jpXm76Z8XHFSCtttGo7TVY6lcdAIngx70yB8i-LpX9NvenH0je0OiH08CADCzVQfr-ebD8DRJAtVk88P4scS4',
                createdAt: now,
                updatedAt: now,
            }
            let app2 = {
                id: 'DEMO_APP_IOS',
                platform: 'IOS',
                secret: '541ec90bf636f0a8847885af37faedc258dcc875481f870d507c64d0e785bc1e',
                createdAt: now,
                updatedAt: now,
            }
            let user1 = {
                hash: 'a0e2676406bbea729dbb8c5ce7c4c92bf62980953abb4fab544147df65bb72a7', // 6281234567890
                createdAt: now,
                updatedAt: now,
            }
            await Promise.all([
                queryInterface.bulkInsert('LegacyAdmins', [admin1]),
                queryInterface.bulkInsert('LegacyApps', [app1, app2]),
                queryInterface.bulkInsert('LegacyUsers', [user1]),
            ])

            let nowStr = now.toJSON().slice(0, 19).replace('T', ' ')
            let s = queryInterface.sequelize
            let users = await s.query('select * from LegacyUsers', {type: s.QueryTypes.SELECT})
            let apps = await s.query('select * from LegacyApps', {type: s.QueryTypes.SELECT})
            let sql = `insert into LegacyAppUsers (userId, appId, hash, deviceId, notifId, createdAt, updatedAt) values 
				('${users[0].id}', '${apps[0].id}', '7a009b9c3203ac3ff081146137e658583d2d60cf867acdb49716b84f1603f8a4', 'DEVICE_ID', 'NOTIF_ID', '${nowStr}', '${nowStr}'),
				('${users[0].id}', '${apps[1].id}', '0c88468123e1c193a5f2e925d360266025f739f30ed0eeab7321887905f8c68c', 'DEVICE_ID', 'NOTIF_ID', '${nowStr}', '${nowStr}')
			`
            await s.query(sql)
            await transaction.commit()
        } catch (e) {
            await transaction.rollback()
            throw e
        }
    },
    down: async queryInterface => {
        const transaction = await queryInterface.sequelize.transaction()
        try {
            await Promise.all([
                queryInterface.bulkDelete('LegacyAdmins', null),
                queryInterface.bulkDelete('LegacyApps', null),
                queryInterface.bulkDelete('LegacyUsers', null)
            ])
            await transaction.commit()
        } catch (e) {
            await transaction.rollback()
            throw e
        }
    }
}
