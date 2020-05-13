import BigNumber from 'bignumber.js'
import { expectSaga } from 'redux-saga-test-plan'
import { select } from 'redux-saga/effects'
import { showError } from 'src/alert/actions'
import { TokenTransactionType } from 'src/apollo/types'
import { ErrorMessages } from 'src/app/ErrorMessages'
import {
  addressToE164NumberSelector,
  e164NumberToAddressSelector,
  E164NumberToAddressType,
} from 'src/identity/reducer'
import { replace } from 'src/navigator/NavigationService'
import { Screens } from 'src/navigator/Screens'
import { BarcodeTypes } from 'src/qrcode/utils'
import { RecipientKind } from 'src/recipients/recipient'
import { recipientCacheSelector } from 'src/recipients/reducer'
import {
  Actions,
  HandleBarcodeDetected,
  QrCode,
  ValidateRecipientAddressAction,
  validateRecipientAddressFailure,
  validateRecipientAddressSuccess,
} from 'src/send/actions'
import { watchQrCodeDetections, watchValidateRecipientAddress } from 'src/send/saga'
import { userAddressSelector } from 'src/web3/reducer'
import {
  mockAccount,
  mockAccount2Invite,
  mockAccountInvite,
  mockE164Number,
  mockE164NumberInvite,
  mockInvitableRecipient2,
  mockName,
  mockQrCodeData,
  mockQrCodeData2,
} from 'test/values'

jest.mock('src/utils/time', () => ({
  clockInSync: () => true,
}))

const mockE164NumberToAddress: E164NumberToAddressType = {
  [mockE164NumberInvite]: [mockAccountInvite, mockAccount2Invite],
}

const mockTransactionData = {
  recipient: mockInvitableRecipient2,
  amount: new BigNumber(1),
  reason: 'Something',
  type: TokenTransactionType.Sent,
}

describe(watchQrCodeDetections, () => {
  beforeAll(() => {
    jest.useRealTimers()
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  it('navigates to the send amount screen with a valid qr code', async () => {
    const data: QrCode = { type: BarcodeTypes.QR_CODE, data: mockQrCodeData }

    await expectSaga(watchQrCodeDetections)
      .provide([
        [select(addressToE164NumberSelector), {}],
        [select(recipientCacheSelector), {}],
        [select(e164NumberToAddressSelector), {}],
      ])
      .dispatch({ type: Actions.BARCODE_DETECTED, data })
      .silentRun()
    expect(replace).toHaveBeenCalledWith(Screens.SendAmount, {
      recipient: {
        address: mockAccount,
        displayName: mockName,
        displayId: mockE164Number,
        e164PhoneNumber: mockE164Number,
        kind: RecipientKind.QrCode,
      },
    })
  })

  it('navigates to the send amount screen with a qr code with an invalid display name', async () => {
    const data: QrCode = { type: BarcodeTypes.QR_CODE, data: mockQrCodeData.replace(mockName, '') }

    await expectSaga(watchQrCodeDetections)
      .provide([
        [select(addressToE164NumberSelector), {}],
        [select(recipientCacheSelector), {}],
        [select(e164NumberToAddressSelector), {}],
      ])
      .dispatch({ type: Actions.BARCODE_DETECTED, data })
      .silentRun()
    expect(replace).toHaveBeenCalledWith(Screens.SendAmount, {
      recipient: {
        address: mockAccount,
        displayName: '',
        displayId: mockE164Number,
        e164PhoneNumber: mockE164Number,
        kind: RecipientKind.QrCode,
      },
    })
  })

  it('navigates to the send amount screen with a qr code with an invalid phone number', async () => {
    const data: QrCode = {
      type: BarcodeTypes.QR_CODE,
      data: mockQrCodeData.replace(mockE164Number, ''),
    }

    await expectSaga(watchQrCodeDetections)
      .provide([
        [select(addressToE164NumberSelector), {}],
        [select(recipientCacheSelector), {}],
        [select(e164NumberToAddressSelector), {}],
      ])
      .dispatch({ type: Actions.BARCODE_DETECTED, data })
      .silentRun()
    expect(replace).toHaveBeenCalledWith(Screens.SendAmount, {
      recipient: {
        address: mockAccount,
        displayName: mockName,
        displayId: '',
        e164PhoneNumber: '',
        kind: RecipientKind.QrCode,
      },
    })
  })

  it('displays an error when scanning an invalid qr code', async () => {
    const INVALID_QR = 'not-json'
    const data: QrCode = { type: BarcodeTypes.QR_CODE, data: INVALID_QR }

    await expectSaga(watchQrCodeDetections)
      .provide([
        [select(addressToE164NumberSelector), {}],
        [select(recipientCacheSelector), {}],
        [select(e164NumberToAddressSelector), {}],
      ])
      .dispatch({ type: Actions.BARCODE_DETECTED, data })
      .put(showError(ErrorMessages.QR_FAILED_NO_ADDRESS))
      .silentRun()
    expect(replace).not.toHaveBeenCalled()
  })

  it('displays an error when scanning a qr code with no address', async () => {
    const INVALID_QR_NO_ADDRESS = '{"e164PhoneNumber":"+>19999907599","displayName":"Joe"}'
    const data: QrCode = { type: BarcodeTypes.QR_CODE, data: INVALID_QR_NO_ADDRESS }

    await expectSaga(watchQrCodeDetections)
      .provide([
        [select(addressToE164NumberSelector), {}],
        [select(recipientCacheSelector), {}],
        [select(e164NumberToAddressSelector), {}],
      ])
      .dispatch({ type: Actions.BARCODE_DETECTED, data })
      .put(showError(ErrorMessages.QR_FAILED_NO_ADDRESS))
      .silentRun()
    expect(replace).not.toHaveBeenCalled()
  })

  it('displays an error when scanning a qr code with an invalid address', async () => {
    const INVALID_QR_ADDRESS =
      '{"address":"not-an-address","e164PhoneNumber":"+>19999907599","displayName":"Joe"}'
    const data: QrCode = { type: BarcodeTypes.QR_CODE, data: INVALID_QR_ADDRESS }

    await expectSaga(watchQrCodeDetections)
      .provide([
        [select(addressToE164NumberSelector), {}],
        [select(recipientCacheSelector), {}],
        [select(e164NumberToAddressSelector), {}],
      ])
      .dispatch({ type: Actions.BARCODE_DETECTED, data })
      .put(showError(ErrorMessages.QR_FAILED_INVALID_ADDRESS))
      .silentRun()
    expect(replace).not.toHaveBeenCalled()
  })

  it('navigates to the send confirmation screen when secure send scan is successful', async () => {
    const data: QrCode = { type: BarcodeTypes.QR_CODE, data: mockQrCodeData2 }
    const qrAction: HandleBarcodeDetected = {
      type: Actions.BARCODE_DETECTED,
      data,
      scanIsForSecureSend: true,
      transactionData: mockTransactionData,
    }
    await expectSaga(watchQrCodeDetections)
      .provide([
        [select(addressToE164NumberSelector), {}],
        [select(recipientCacheSelector), {}],
        [select(e164NumberToAddressSelector), mockE164NumberToAddress],
      ])
      .dispatch(qrAction)
      .put(validateRecipientAddressSuccess(mockE164NumberInvite, mockAccount2Invite.toLowerCase()))
      .silentRun()
    expect(replace).toHaveBeenCalledWith(Screens.SendConfirmation, {
      transactionData: mockTransactionData,
    })
  })

  it("displays an error when QR code scanned for secure send doesn't map to the recipient", async () => {
    const data: QrCode = { type: BarcodeTypes.QR_CODE, data: mockQrCodeData }
    const qrAction: HandleBarcodeDetected = {
      type: Actions.BARCODE_DETECTED,
      data,
      scanIsForSecureSend: true,
      transactionData: mockTransactionData,
    }
    await expectSaga(watchQrCodeDetections)
      .provide([
        [select(addressToE164NumberSelector), {}],
        [select(recipientCacheSelector), {}],
        [select(e164NumberToAddressSelector), mockE164NumberToAddress],
      ])
      .dispatch(qrAction)
      .put(showError(ErrorMessages.QR_FAILED_INVALID_RECIPIENT))
      .silentRun()
    expect(replace).not.toHaveBeenCalled()
  })
})

describe(watchValidateRecipientAddress, () => {
  beforeAll(() => {
    jest.useRealTimers()
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  it('full validation fails if the inputted address does not belong to the recipient', async () => {
    const validateAction: ValidateRecipientAddressAction = {
      type: Actions.VALIDATE_RECIPIENT_ADDRESS,
      userInputOfFullAddressOrLastFourDigits: mockAccount,
      fullAddressValidationRequired: true,
      recipient: mockInvitableRecipient2,
    }

    await expectSaga(watchValidateRecipientAddress)
      .provide([
        [select(userAddressSelector), mockAccount],
        [select(e164NumberToAddressSelector), mockE164NumberToAddress],
      ])
      .dispatch(validateAction)
      .put(validateRecipientAddressFailure())
      .run()
  })

  it('full validation succeeds if the inputted address belongs to the recipient', async () => {
    const validateAction: ValidateRecipientAddressAction = {
      type: Actions.VALIDATE_RECIPIENT_ADDRESS,
      userInputOfFullAddressOrLastFourDigits: mockAccount2Invite,
      fullAddressValidationRequired: true,
      recipient: mockInvitableRecipient2,
    }

    await expectSaga(watchValidateRecipientAddress)
      .provide([
        [select(userAddressSelector), mockAccount],
        [select(e164NumberToAddressSelector), mockE164NumberToAddress],
      ])
      .dispatch(validateAction)
      .put(validateRecipientAddressSuccess(mockE164NumberInvite, mockAccount2Invite.toLowerCase()))
      .run()
  })

  it('partial validation fails if the inputted address does not belong to the recipient', async () => {
    const validateAction: ValidateRecipientAddressAction = {
      type: Actions.VALIDATE_RECIPIENT_ADDRESS,
      userInputOfFullAddressOrLastFourDigits: mockAccount.slice(-4),
      fullAddressValidationRequired: false,
      recipient: mockInvitableRecipient2,
    }

    await expectSaga(watchValidateRecipientAddress)
      .provide([
        [select(userAddressSelector), mockAccount],
        [select(e164NumberToAddressSelector), mockE164NumberToAddress],
      ])
      .dispatch(validateAction)
      .put(validateRecipientAddressFailure())
      .run()
  })

  it('partial validation succeeds if the inputted address belongs to the recipient', async () => {
    const validateAction: ValidateRecipientAddressAction = {
      type: Actions.VALIDATE_RECIPIENT_ADDRESS,
      userInputOfFullAddressOrLastFourDigits: mockAccount2Invite.slice(-4),
      fullAddressValidationRequired: false,
      recipient: mockInvitableRecipient2,
    }

    await expectSaga(watchValidateRecipientAddress)
      .provide([
        [select(userAddressSelector), mockAccount],
        [select(e164NumberToAddressSelector), mockE164NumberToAddress],
      ])
      .dispatch(validateAction)
      .put(validateRecipientAddressSuccess(mockE164NumberInvite, mockAccount2Invite.toLowerCase()))
      .run()
  })
})
