const documentUrl = (value) => {
  if (typeof value === 'string') return value.trim()
  if (!value || typeof value !== 'object') return ''
  const url = value.url || value.downloadURL || value.downloadUrl ||
    value.imageUrl || value.fileUrl || value.storageUrl
  return typeof url === 'string' ? url.trim() : ''
}

const documentLabel = (value, fallback) => {
  const text = String(value || fallback || 'Verification document')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/[_-]+/g, ' ')
    .trim()
  const normalized = text.toLowerCase()

  if (/\b(selfie|face|facial)\b/.test(normalized)) return 'Selfie / Face Verification'
  if (/\b(certificate|certification|trade|license|licence)\b/.test(normalized)) {
    return 'Trade Certificate (Optional)'
  }
  if (/\b(id|identity|identification|passport)\b/.test(normalized)) return 'ID document'
  return text.replace(/\b\w/g, (letter) => letter.toUpperCase())
}

export const getVerificationDocuments = (user) => {
  if (!user || typeof user !== 'object') return []

  const documents = []
  const addDocument = (label, value, fallback) => {
    const url = documentUrl(value)
    if (url) documents.push({ label: documentLabel(label, fallback), url })
  }

  const documentCollections = [
    user.documents,
    user.verificationDocuments,
    user.verification?.documents,
    user.verification?.uploadedDocuments,
    user.verificationData?.documents,
  ]

  documentCollections.forEach((collection) => {
    if (Array.isArray(collection)) {
      collection.forEach((document, index) => {
        const label = document?.name || document?.label || document?.type
        addDocument(label, document, `Document ${index + 1}`)
      })
    } else if (collection && typeof collection === 'object') {
      Object.entries(collection).forEach(([key, document]) => {
        addDocument(document?.name || document?.label || document?.type || key, document, key)
      })
    }
  })

  const knownFields = [
    ['ID document', user.idDocumentUrl || user.idDocumentURL],
    ['ID document', user.identityDocumentUrl || user.identityDocumentURL || user.idUrl],
    ['ID document front', user.idFrontUrl || user.idDocumentFrontUrl],
    ['ID document back', user.idBackUrl || user.idDocumentBackUrl],
    ['Selfie / Face Verification', user.selfieUrl || user.selfieURL || user.selfieImageUrl || user.selfiePhotoUrl],
    ['Selfie / Face Verification', user.faceVerificationUrl || user.faceVerificationImageUrl || user.faceUrl || user.faceImageUrl],
    ['Selfie / Face Verification', user.selfieVerificationUrl || user.faceMatchImageUrl],
    ['Trade Certificate (Optional)', user.certificateUrl || user.certificateURL || user.tradeCertificateUrl],
    ['Trade Certificate (Optional)', user.licenseUrl || user.licenceUrl || user.certificationUrl],
    ['Proof of address', user.proofOfAddressUrl || user.addressProofUrl],
    ['Verification document', user.documentUrl || user.verificationDocumentUrl],
  ]
  knownFields.forEach(([label, value]) => addDocument(label, value))

  const verificationObjects = [user, user.verification, user.verificationData]
  verificationObjects.forEach((object) => {
    if (!object || typeof object !== 'object') return
    Object.entries(object).forEach(([key, value]) => {
      if (/(selfie|face.?verification|face.?match)/i.test(key)) {
        addDocument('Selfie / Face Verification', value)
      } else if (/(trade.?certificate|certificate|certification)/i.test(key)) {
        addDocument('Trade Certificate (Optional)', value)
      }
    })
  })

  return documents.filter((document, index, all) => (
    all.findIndex((item) => item.url === document.url) === index
  ))
}

export const isPendingVerification = (user) => (
  user?.role === 'worker' && (
    user.verificationStatus === 'pending' ||
    (!user.verificationStatus && !user.isVerified && getVerificationDocuments(user).length > 0)
  )
)
