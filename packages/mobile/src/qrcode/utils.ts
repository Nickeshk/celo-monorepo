import { isValidAddress } from '@celo/utils/src/address'
import { isEmpty } from 'lodash'
import * as RNFS from 'react-native-fs'
import Share from 'react-native-share'
import { put } from 'redux-saga/effects'
import { showError } from 'src/alert/actions'
import { ErrorMessages } from 'src/app/ErrorMessages'
import { validateRecipientAddressSuccess } from 'src/identity/actions'
import { AddressToE164NumberType, E164NumberToAddressType } from 'src/identity/reducer'
import { replace } from 'src/navigator/NavigationService'
import { Screens } from 'src/navigator/Screens'
import {
  getRecipientFromAddress,
  NumberToRecipient,
  Recipient,
  RecipientKind,
} from 'src/recipients/recipient'
import { QrCode, storeLatestInRecents, SVG } from 'src/send/actions'
import { TransactionDataInput } from 'src/send/SendAmount'
import Logger from 'src/utils/Logger'

export enum BarcodeTypes {
  QR_CODE = 'QR_CODE',
}

const TAG = 'QR/utils'

const QRFileName = '/celo-qr.png'

export async function shareSVGImage(svg: SVG) {
  if (!svg) {
    return
  }
  svg.toDataURL(async (data: string) => {
    const path = RNFS.DocumentDirectoryPath + QRFileName
    try {
      await RNFS.writeFile(path, data, 'base64')
      Share.open({
        url: 'file://' + path,
        type: 'image/png',
      }).catch((err: Error) => {
        throw err
      })
    } catch (e) {
      Logger.warn(TAG, e)
    }
  })
}

export function* handleBarcode(
  barcode: QrCode,
  addressToE164Number: AddressToE164NumberType,
  recipientCache: NumberToRecipient,
  e164NumberToAddress: E164NumberToAddressType,
  secureSendTxData?: TransactionDataInput
) {
  let data: { address: string; e164PhoneNumber: string; displayName: string } | undefined

  try {
    data = JSON.parse(barcode.data)
  } catch (e) {
    Logger.warn(TAG, 'QR code read failed with ' + e)
  }
  if (typeof data !== 'object' || isEmpty(data.address)) {
    yield put(showError(ErrorMessages.QR_FAILED_NO_ADDRESS))
    return
  }
  if (!isValidAddress(data.address)) {
    yield put(showError(ErrorMessages.QR_FAILED_INVALID_ADDRESS))
    return
  }
  try {
    if (secureSendTxData) {
      if (!secureSendTxData.recipient.e164PhoneNumber) {
        throw Error(`Invalid recipient type for Secure Send: ${secureSendTxData.recipient.kind}`)
      }

      const userScannedAddress = data.address.toLowerCase()
      const { e164PhoneNumber } = secureSendTxData.recipient
      const possibleRecievingAddresses = e164NumberToAddress[e164PhoneNumber]
      // This should never happen. Secure Send is triggered when there are
      // mutliple addrresses for a given phone number
      if (!possibleRecievingAddresses) {
        throw Error("No addresses associated with recipient's phone number")
      }

      const possibleRecievingAddressesFormatted = possibleRecievingAddresses.map((address) =>
        address.toLowerCase()
      )
      if (!possibleRecievingAddressesFormatted.includes(userScannedAddress)) {
        yield put(showError(ErrorMessages.QR_FAILED_INVALID_RECIPIENT))
        return
      }

      yield put(validateRecipientAddressSuccess(e164PhoneNumber, userScannedAddress))
    }
  } catch (error) {
    Logger.error(TAG + '@handleBarcode', `Error with Secure Send: `, error)
  }

  if (typeof data.e164PhoneNumber !== 'string') {
    // Default for invalid e164PhoneNumber
    data.e164PhoneNumber = ''
  }
  if (typeof data.displayName !== 'string') {
    // Default for invalid displayName
    data.displayName = ''
  }
  const cachedRecipient = getRecipientFromAddress(data.address, addressToE164Number, recipientCache)

  const recipient: Recipient = cachedRecipient
    ? {
        ...data,
        kind: RecipientKind.QrCode,
        displayId: data.e164PhoneNumber,
        phoneNumberLabel: 'QR Code',
        thumbnailPath: cachedRecipient.thumbnailPath,
        contactId: cachedRecipient.contactId,
      }
    : {
        ...data,
        kind: RecipientKind.QrCode,
        displayId: data.e164PhoneNumber,
      }
  yield put(storeLatestInRecents(recipient))

  if (secureSendTxData) {
    replace(Screens.SendConfirmation, { transactionData: secureSendTxData })
  } else {
    replace(Screens.SendAmount, { recipient })
  }
}
