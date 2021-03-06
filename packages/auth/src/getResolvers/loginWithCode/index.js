import {resolver} from '@orion-js/app'
import findUserByEmail from '../../helpers/findUserByEmail'
import createSession from '../../helpers/createSession'
import requireTwoFactor from '../../helpers/requireTwoFactor'
import validate from './validate'

export default ({Users, Session, Sessions, twoFactor}) =>
  resolver({
    name: 'loginWithCode',
    params: {
      email: {
        type: 'email',
        label: 'Email',
        async custom(email) {
          const user = await findUserByEmail({email, Users})
          if (!user) {
            return 'userNotFound'
          }
        }
      },
      token: {
        type: String,
        label: 'Token'
      },
      code: {
        type: String,
        label: 'Code',
        async clean(code) {
          if (!code) return
          return code.toLowerCase()
        }
      }
    },
    returns: Session,
    mutation: true,
    resolve: async function({email, code, token}, viewer) {
      const user = await findUserByEmail({email, Users})

      await validate({user, code, token})

      const userEmail = user.emails.find(({address}) => address === email)

      if (!userEmail.verified) {
        await Users.update(
          {_id: user._id, 'emails.address': email},
          {$set: {'emails.$.verified': true}}
        )
      }

      await user.update({$unset: {'services.loginCode': ''}})

      if (twoFactor) {
        await requireTwoFactor({userId: user._id, twoFactorCode: viewer.twoFactorCode})
      }

      return await createSession(user, viewer)
    }
  })
