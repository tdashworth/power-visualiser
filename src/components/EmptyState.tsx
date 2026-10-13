import React from "react";
import { Text, tokens } from "@fluentui/react-components";

interface EmptyStateProps {
  icon: React.ReactElement;
  title: string;
  description: string;
}

export default function EmptyState({ icon, title, description }: EmptyStateProps) {
  return (
    <div
      style={{
        flex: 1,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 8,
        padding: 32,
        textAlign: "center",
      }}
    >
      <div
        style={{
          width: 56,
          height: 56,
          borderRadius: "50%",
          backgroundColor: tokens.colorNeutralBackground3,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: tokens.colorNeutralForeground3,
        }}
      >
        {icon}
      </div>
      <Text weight="semibold" size={400}>
        {title}
      </Text>
      <Text size={200} style={{ color: tokens.colorNeutralForeground3, maxWidth: 380 }}>
        {description}
      </Text>
    </div>
  );
}
