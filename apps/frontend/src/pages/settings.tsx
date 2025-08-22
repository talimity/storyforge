import { Container, Tabs } from "@chakra-ui/react";
import { FaGear } from "react-icons/fa6";
import { ProvidersTab } from "@/components/features/inference/providers-tab";
import { PageHeader } from "@/components/ui";

export function SettingsPage() {
  return (
    <Container>
      <PageHeader.Root>
        <PageHeader.Title>Settings</PageHeader.Title>
        <PageHeader.Tagline>
          Configure application preferences and API keys
        </PageHeader.Tagline>
        <PageHeader.Tabs
          tabs={[
            {
              value: "providers",
              label: "Providers",
              icon: <FaGear />,
            },
          ]}
          defaultValue="providers"
        >
          <Tabs.Content value="providers">
            <ProvidersTab />
          </Tabs.Content>
        </PageHeader.Tabs>
      </PageHeader.Root>
    </Container>
  );
}
