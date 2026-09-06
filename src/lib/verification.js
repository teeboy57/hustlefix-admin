export const getVerificationDocuments = (user) => [
  { label: 'ID document', url: user?.idDocumentUrl },
  { label: 'Certificate', url: user?.certificateUrl },
].filter((document) => typeof document.url === 'string' && document.url.trim())

export const isPendingVerification = (user) => (
  user?.role === 'worker' && (
    user.verificationStatus === 'pending' ||
    (!user.verificationStatus && !user.isVerified && getVerificationDocuments(user).length > 0)
  )
)
