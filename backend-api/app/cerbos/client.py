import httpx

from app.config import settings


class CerbosClient:
    """Cliente fino sobre a API REST do Cerbos (POST /api/check/resources).

    ponytail: httpx direto em vez do SDK oficial — a superficie de import do SDK
    muda entre versoes e quebraria o boot. Trocar por SDK depois e trivial.
    ponytail: cria um AsyncClient por chamada (overhead de conexao). Suficiente p/
    PoC; se latencia importar, manter um client compartilhado no lifespan.
    """

    def __init__(self, base_url: str) -> None:
        self._base = base_url.rstrip("/")

    async def is_allowed(
        self,
        *,
        principal_id: str,
        roles: list[str],
        action: str,
        resource_kind: str,
        resource_id: str,
        resource_attr: dict | None = None,
        principal_attr: dict | None = None,
    ) -> bool:
        payload = {
            "principal": {
                "id": principal_id,
                "roles": roles,
                "attr": principal_attr or {},
            },
            "resources": [
                {
                    "resource": {
                        "kind": resource_kind,
                        "id": resource_id,
                        "attr": resource_attr or {},
                    },
                    "actions": [action],
                }
            ],
        }
        async with httpx.AsyncClient(timeout=5.0) as client:
            resp = await client.post(f"{self._base}/api/check/resources", json=payload)
            resp.raise_for_status()
            data = resp.json()

        results = data.get("results", [])
        if not results:
            return False
        return results[0].get("actions", {}).get(action) == "EFFECT_ALLOW"

    async def allowed_resource_ids(
        self,
        *,
        principal_id: str,
        roles: list[str],
        action: str,
        resource_kind: str,
        resources: list[dict],
    ) -> set[str]:
        """1 CheckResources p/ N recursos. resources: [{'id':..., 'attr':{...}}, ...].

        Retorna o conjunto de ids com EFFECT_ALLOW p/ a acao. Usado no filtro da
        busca RAG (cruza os resultados do OpenSearch com as permissoes do Cerbos).
        """
        if not resources:
            return set()
        payload = {
            "principal": {"id": principal_id, "roles": roles, "attr": {}},
            "resources": [
                {
                    "resource": {
                        "kind": resource_kind,
                        "id": r["id"],
                        "attr": r.get("attr", {}),
                    },
                    "actions": [action],
                }
                for r in resources
            ],
        }
        async with httpx.AsyncClient(timeout=5.0) as client:
            resp = await client.post(f"{self._base}/api/check/resources", json=payload)
            resp.raise_for_status()
            data = resp.json()

        allowed: set[str] = set()
        for res in data.get("results", []):
            if res.get("actions", {}).get(action) == "EFFECT_ALLOW":
                allowed.add(res.get("resource", {}).get("id"))
        return allowed


cerbos = CerbosClient(settings.CERBOS_HTTP_URL)
