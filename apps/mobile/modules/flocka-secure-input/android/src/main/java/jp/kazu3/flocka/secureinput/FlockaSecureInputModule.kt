package jp.kazu3.flocka.secureinput

import android.text.GetChars
import android.text.method.PasswordTransformationMethod
import android.view.View
import android.view.ViewGroup
import android.widget.TextView
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import kotlinx.coroutines.launch

private const val BULLET = '•'

/**
 * Android reveals the last typed character of a password field for about 1.5 s,
 * and React Native has no option to turn that off. This keeps the platform's
 * password behaviour (input type, keyboard without suggestions, no copy,
 * accessibility as a password) and only changes how the text is drawn.
 */
private object BulletsOnly : PasswordTransformationMethod() {
  override fun getTransformation(source: CharSequence, view: View?): CharSequence {
    // The parent registers what keeps the field redrawn while typing; its
    // reveal spans are ignored because the characters below never read them.
    super.getTransformation(source, view)
    return Bullets(source)
  }
}

private class Bullets(private val source: CharSequence) : CharSequence, GetChars {
  override val length: Int get() = source.length
  override fun get(index: Int): Char = BULLET
  override fun subSequence(startIndex: Int, endIndex: Int): CharSequence =
    String(CharArray(endIndex - startIndex) { BULLET })
  override fun toString(): String = String(CharArray(length) { BULLET })
  override fun getChars(start: Int, end: Int, dest: CharArray, destoff: Int) {
    for (index in start until end) dest[destoff + index - start] = BULLET
  }
}

private fun View.passwordFields(): List<TextView> =
  when {
    this is TextView && transformationMethod is PasswordTransformationMethod -> listOf(this)
    this is ViewGroup -> (0 until childCount).flatMap { getChildAt(it).passwordFields() }
    else -> emptyList()
  }

class FlockaSecureInputModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("FlockaSecureInput")
    // `viewTag` is the React tag of a view that contains the password input.
    // Call it again after the field's secureTextEntry changes: React Native
    // then sets the platform's own password method again.
    AsyncFunction("hideTypedCharacters") { viewTag: Int ->
      appContext.mainQueue.launch {
        appContext.findView<View>(viewTag)?.passwordFields()?.forEach { field ->
          if (field.transformationMethod !== BulletsOnly) field.transformationMethod = BulletsOnly
        }
      }
    }
  }
}
