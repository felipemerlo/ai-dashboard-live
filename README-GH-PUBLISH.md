# Publicar dashboard no GitHub Pages

1. Crie um repositório no GitHub (nome por exemplo `ai-dashboard-live`).
2. No seu computador, emita:

```
git remote add origin git@github.com:<seu-usuario>/<seu-repo>.git
git branch -M main
git add .
git commit -m "Prepare site and GitHub Actions for Pages"
git push -u origin main
```

3. O workflow `.github/workflows/deploy.yml` roda no push e a cada 6h; ele executa o coletor e publica o conteúdo de `reports/ai-dashboard-live` na branch `gh-pages`.

4. Após o primeiro deploy, habilite GitHub Pages nas configurações do repositório (branch `gh-pages` / pasta `/`). O site ficará disponível em `https://<seu-usuario>.github.io/<seu-repo>/`.

5. Se preferir que eu faça o push e crie o repo por você, forneça um GitHub Personal Access Token com `repo` escopo (apenas se confiar).

