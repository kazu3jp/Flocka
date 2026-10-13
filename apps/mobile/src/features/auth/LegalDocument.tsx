import {
  LEGAL_DOCUMENTS,
  LEGAL_VERSION,
  type LegalTitle,
} from "@flocka/domain";
import { View } from "react-native";
import { C, S, T } from "../../components/ui";

export function LegalDocument({ title }: { title: LegalTitle }) {
  return (
    <View style={S.gap}>
      <T color={C.muted} size={12}>
        更新日: {LEGAL_VERSION}
      </T>
      {LEGAL_DOCUMENTS[title].map((section) => (
        <View key={section.heading} style={S.gap}>
          <T display size={15}>
            {section.heading}
          </T>
          <T size={13}>{section.body}</T>
        </View>
      ))}
    </View>
  );
}
