package jp.kazu3.flocka.googlesignin

import androidx.credentials.CredentialManager
import androidx.credentials.CustomCredential
import androidx.credentials.GetCredentialRequest
import androidx.credentials.exceptions.GetCredentialCancellationException
import androidx.credentials.exceptions.GetCredentialException
import androidx.credentials.exceptions.GetCredentialInterruptedException
import androidx.credentials.exceptions.GetCredentialProviderConfigurationException
import androidx.credentials.exceptions.GetCredentialUnsupportedException
import androidx.credentials.exceptions.NoCredentialException
import com.google.android.libraries.identity.googleid.GetSignInWithGoogleOption
import com.google.android.libraries.identity.googleid.GoogleIdTokenCredential
import com.google.android.libraries.identity.googleid.GoogleIdTokenParsingException
import expo.modules.kotlin.exception.CodedException
import expo.modules.kotlin.functions.Coroutine
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

/**
 * Native Google account chooser for Android (Credential Manager). It returns the
 * Google ID token; the app sends it to the Better Auth server, which verifies it.
 * Every failure carries a stable code (see FlockaGoogleSignIn.types.ts) so the
 * JavaScript side can tell a cancel from a real problem.
 */
class FlockaGoogleSignInModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("FlockaGoogleSignIn")
    // `webClientId` is the Web application OAuth client; the token's audience
    // becomes that client, which is what the server verifies. `nonce` is echoed
    // back inside the token so the server can reject a replayed token.
    AsyncFunction("signIn") Coroutine { webClientId: String, nonce: String ->
      val activity = appContext.currentActivity
        ?: throw CodedException("NO_ACTIVITY", "画面が開かれていないためGoogleログインを開始できません", null)
      val option = GetSignInWithGoogleOption.Builder(webClientId).setNonce(nonce).build()
      val request = GetCredentialRequest.Builder().addCredentialOption(option).build()
      val credential = try {
        CredentialManager.create(activity).getCredential(activity, request).credential
      } catch (error: GetCredentialException) {
        throw error.toCodedException()
      }
      if (credential !is CustomCredential || credential.type != GoogleIdTokenCredential.TYPE_GOOGLE_ID_TOKEN_CREDENTIAL)
        throw CodedException("INVALID_CREDENTIAL", "Googleの認証情報の形式が想定と異なります", null)
      try {
        GoogleIdTokenCredential.createFrom(credential.data).idToken
      } catch (error: GoogleIdTokenParsingException) {
        throw CodedException("INVALID_CREDENTIAL", "Googleの認証情報を読み取れませんでした", error)
      }
    }
  }
}

private fun GetCredentialException.toCodedException(): CodedException {
  val detail = "${this::class.java.simpleName}: ${message ?: type}"
  return when {
    this is GetCredentialCancellationException -> CodedException("CANCELLED", detail, this)
    this is NoCredentialException -> CodedException("NO_ACCOUNT", detail, this)
    this is GetCredentialProviderConfigurationException -> CodedException("PROVIDER_UNAVAILABLE", detail, this)
    this is GetCredentialInterruptedException -> CodedException("INTERRUPTED", detail, this)
    this is GetCredentialUnsupportedException -> CodedException("UNSUPPORTED", detail, this)
    // Google reports a wrong package name / SHA-1 / client ID as "[28444] Developer console is not set up correctly".
    message?.contains("28444") == true || message?.contains("Developer console", ignoreCase = true) == true ->
      CodedException("CONFIGURATION", detail, this)
    else -> CodedException("FAILED", detail, this)
  }
}
