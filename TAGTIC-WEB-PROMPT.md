# Application Web Angular — Front-end Plateforme d’Annotation d’Images
# Nom de code du projet : TAGTIC-UI
# Attendu : Code de la solution en zip

# 1. Objectif

Mettre en place une application web Angular (SPA) qui consomme l’API REST TAGTIC et expose les IHM permettant de :

* gérer les projets d’annotation (CRUD + cycle de vie du statut) ;
* configurer le formulaire d’annotation d’un projet et ses champs dynamiques ;
* associer et visualiser les images d’un projet ;
* annoter une image à partir du formulaire prérempli ;
* visualiser et lister les annotations.

L’ergonomie et le design system reposent sur **TailAdmin** (template d’administration Tailwind CSS) : sidebar responsive, header, cartes, tableaux, formulaires, badges de statut, mode sombre.

---

# 2. Stack Technique

## Frontend

* Angular 21 (composants **standalone**, pas de NgModule)
* TypeScript 5.x
* **Signals** pour la gestion d’état réactive
* Tailwind CSS v4 (design system TailAdmin)
* TailAdmin Angular (template d’admin : layout, sidebar, UI kit)
* Angular Router (routes standalone + lazy loading)
* `HttpClient` + intercepteurs (`provideHttpClient(withInterceptors(...))`)
* Reactive Forms (`FormGroup` / `FormControl`) pour les formulaires dynamiques
* ApexCharts (`ng-apexcharts`) pour les indicateurs du tableau de bord
* Flatpickr pour les champs de type `DATE`
* RxJS (interop avec Signals via `toSignal` / `toObservable`)

## Outillage

* Angular CLI
* Build : `ng build` (esbuild)

---

# 3. Intégration avec l’API REST

L’application consomme l’API décrite dans le contexte back-end TAGTIC. Aucune logique métier n’est dupliquée côté front : les règles (transitions de statut, validation typée) sont portées par l’API, le front les reflète et désactive/active l’UI en conséquence.

## Configuration

* URL de base de l’API exposée via un fichier d’environnement : `environment.apiBaseUrl` (ex. `http://localhost:8080/api`).
* Pas de Spring Security côté back : aucun token d’authentification à gérer dans cette version. Le champ `annotatedBy` / `createdBy` est saisi ou simulé côté UI (ex. champ « utilisateur courant » en haut de page).

## Enveloppe de réponse standardisée

L’API renvoie systématiquement une enveloppe `{ success, data }` ou `{ success, error }`. Un intercepteur HTTP déballe la réponse :

* en cas de `success: true`, l’intercepteur retourne directement `data` au service ;
* en cas de `success: false`, il lève une erreur typée `ApiError { code, message }` traitée par un service de notifications (toast).

```text
HttpClient → ApiResponseInterceptor → (data | throw ApiError) → Service → Signal → Composant
```

---

# 4. Architecture Front-end

L’application suit une organisation par **fonctionnalités** (feature folders), alignée sur les domaines de l’API (Project, Form, Image, Annotation).

```text
src/app
    ├── core
    │       ├── api            (services HTTP par domaine)
    │       ├── interceptors   (enveloppe réponse, erreurs, loading)
    │       ├── models         (interfaces TypeScript = miroir des DTO API)
    │       └── state          (stores à base de Signals)
    │
    ├── layout                 (coquille TailAdmin : sidebar, header, breadcrumb)
    │
    ├── shared                 (composants UI réutilisables : table, badge, modal, form-field)
    │
    ├── features
    │       ├── dashboard
    │       ├── projects
    │       ├── forms
    │       ├── images
    │       └── annotations
    │
    └── app.routes.ts          (routes standalone + lazy loading)
```

> Chaque service `core/api` mappe 1‑1 un groupe d’endpoints de l’API. Les composants n’appellent jamais `HttpClient` directement : ils passent par les services / stores.

---

# 5. Modèles TypeScript (miroir des DTO API)

Les interfaces reflètent les entités de l’API. Rappels importants issus du contrat back-end :

* `AnnotationProject` ne porte **pas** de `formId` (relation 1‑1 portée par le formulaire) ;
* `ProjectImage` expose `s3Bucket` + `s3Key` (pas d’URL brute) ;
* `AnnotationFieldValue.value` est une **chaîne** (`string`), le typage réel étant porté par `fieldType` ;
* une image n’a qu’**une seule** annotation finale.

```typescript
type ProjectStatus = 'DRAFT' | 'READY' | 'IN_PROGRESS' | 'COMPLETED' | 'ARCHIVED';
type AnnotationStatus = 'PENDING' | 'VALIDATED' | 'REJECTED';
type FieldType = 'TEXT' | 'NUMBER' | 'BOOLEAN' | 'DATE' | 'SELECT';

interface AnnotationProject {
  id: string;
  title: string;
  description: string;
  status: ProjectStatus;
  createdBy: string;
  createdAt: string;   // Instant ISO-8601
  updatedAt: string;
}

interface AnnotationForm {
  id: string;
  projectId: string;
  title: string;
  description: string;
  version: number;
  createdBy: string;
  createdAt: string;
}

interface FormField {
  id: string;
  formId: string;
  name: string;
  label: string;
  type: FieldType;
  required: boolean;
  orderIndex: number;
  defaultValue?: string;
  jsonMappingKey?: string;
  validationRules?: Record<string, unknown>;   // JSON
}

interface ProjectImage {
  id: string;
  projectId: string;
  s3Bucket: string;
  s3Key: string;
  metadata: Record<string, unknown>;            // JSON
  createdAt: string;
}

interface Annotation {
  id: string;
  projectId: string;
  imageId: string;
  annotatedBy: string;
  annotatedAt: string;
  status: AnnotationStatus;
}

interface AnnotationFieldValue {
  id: string;
  annotationId: string;
  formFieldId: string;
  fieldName: string;
  fieldLabel: string;
  fieldType: FieldType;
  value: string;          // toujours string ; cast applicatif via fieldType
  autoFilled: boolean;
  sourceMetadataKey?: string;
  createdAt: string;
}

// Vue retournée par l'endpoint annotation-form (prérempli)
interface PrefilledField {
  formFieldId: string;
  name: string;
  type: FieldType;
  value: string | null;
  autoFilled: boolean;
}
interface PrefilledAnnotationForm {
  imageId: string;
  fields: PrefilledField[];
}
```

---

# 6. Services API (mapping endpoints)

Chaque service expose des méthodes typées qui appellent les endpoints décrits dans le contrat back-end.

## 6.1 ProjectApiService

| Méthode               | Verbe & endpoint                          |
| --------------------- | ----------------------------------------- |
| `list()`              | `GET /api/projects`                       |
| `get(id)`             | `GET /api/projects/{id}`                  |
| `create(req)`         | `POST /api/projects`                      |
| `update(id, req)`     | `PUT /api/projects/{id}`                  |
| `delete(id)`          | `DELETE /api/projects/{id}`               |
| `changeStatus(id, s)` | `PATCH /api/projects/{id}/status`         |

## 6.2 FormApiService (sous-ressource unique du projet)

| Méthode                    | Verbe & endpoint                                |
| -------------------------- | ----------------------------------------------- |
| `createForm(projectId)`    | `POST /api/projects/{projectId}/form`           |
| `getForm(projectId)`       | `GET /api/projects/{projectId}/form`            |
| `addFields(projectId, f)`  | `POST /api/projects/{projectId}/form/fields`    |
| `listFields(projectId)`    | `GET /api/projects/{projectId}/form/fields`     |

## 6.3 ImageApiService

| Méthode                        | Verbe & endpoint                                       |
| ------------------------------ | ------------------------------------------------------ |
| `add(projectId, req)`          | `POST /api/projects/{projectId}/images`                |
| `list(projectId, page, size)`  | `GET /api/projects/{projectId}/images?page=&size=`     |
| `get(imageId)`                 | `GET /api/images/{imageId}`                            |

## 6.4 AnnotationApiService

| Méthode                              | Verbe & endpoint                                                       |
| ------------------------------------ | --------------------------------------------------------------------- |
| `getPrefilledForm(projectId, imgId)` | `GET /api/projects/{projectId}/images/{imageId}/annotation-form`       |
| `save(projectId, imgId, req)`        | `POST /api/projects/{projectId}/images/{imageId}/annotations`          |
| `listByProject(projectId)`           | `GET /api/projects/{projectId}/annotations`                           |
| `getByImage(projectId, imgId)`       | `GET /api/projects/{projectId}/images/{imageId}/annotation` (objet unique, `404` si absente) |

---

# 7. Cartographie des Écrans (IHM)

```text
TAGTIC-UI
    ├── Dashboard
    │       └── Vue d’ensemble (KPI projets, statuts, annotations)
    │
    ├── Projets
    │       ├── Liste des projets (table + filtres + pagination)
    │       ├── Création / Édition projet (modal ou page)
    │       ├── Détail projet (onglets : Aperçu · Formulaire · Images · Annotations)
    │       └── Gestion du statut (stepper / actions contextuelles)
    │
    ├── Formulaire (onglet du projet)
    │       ├── Création du formulaire
    │       └── Éditeur de champs dynamiques (ajout, ordre, type, règles)
    │
    ├── Images (onglet du projet)
    │       ├── Galerie / table des images (paginée)
    │       ├── Ajout d’image (s3Bucket + s3Key + metadata JSON)
    │       └── Détail image (métadonnées + statut d’annotation)
    │
    └── Annotation
            ├── Écran d’annotation (formulaire prérempli + aperçu image)
            └── Consultation d’une annotation existante (lecture seule)
```

---

# 8. Description des Écrans

## 8.1 Dashboard

Page d’accueil reprenant la grille de cartes TailAdmin :

* cartes KPI : nombre de projets par statut (`DRAFT`, `READY`, `IN_PROGRESS`, `COMPLETED`, `ARCHIVED`) ;
* graphique ApexCharts : répartition des annotations par statut (`PENDING` / `VALIDATED` / `REJECTED`) ;
* tableau des projets récents avec badge de statut et lien vers le détail.

## 8.2 Liste des projets

Composant table TailAdmin :

* colonnes : Titre, Description (tronquée), Statut (badge coloré), Créé par, Date, Actions ;
* filtre par statut (dropdown) et recherche par titre ;
* pagination ;
* bouton « Nouveau projet » ouvrant une modal de création.

Mapping badges → statut :

```text
DRAFT        → badge gris
READY        → badge bleu
IN_PROGRESS  → badge ambre
COMPLETED    → badge vert
ARCHIVED     → badge slate (atténué)
```

## 8.3 Détail projet (onglets)

Page avec breadcrumb TailAdmin et navigation par onglets :

* **Aperçu** : métadonnées du projet + actions de cycle de vie (boutons activés selon le statut courant et les conditions de transition) ;
* **Formulaire** : voir 8.4 ;
* **Images** : voir 8.5 ;
* **Annotations** : liste paginée des annotations du projet.

### Cycle de vie (UI)

Les boutons de transition reflètent les règles de l’API et sont **désactivés** si la condition n’est pas remplie, avec une infobulle explicative :

```text
[Passer à READY]        actif si un formulaire avec ≥ 1 champ existe
[Passer à IN_PROGRESS]  actif si ≥ 1 annotation existe (sinon déclenché automatiquement à la 1ère annotation)
[Marquer COMPLETED]     actif si toutes les images sont annotées
[Archiver]              toujours disponible (sauf si déjà ARCHIVED)
```

> La transition réelle est validée par l’API (`PATCH /status`). En cas de refus métier, l’UI affiche le `message` de l’`ApiError`.

## 8.4 Éditeur de formulaire (onglet)

* Si aucun formulaire : bouton « Créer le formulaire » (`POST .../form`).
* Si formulaire présent : éditeur des champs (`FormField`).

Éditeur de champs dynamiques :

* liste ordonnée des champs (drag & drop pour `orderIndex`) ;
* pour chaque champ : `name`, `label`, `type` (TEXT/NUMBER/BOOLEAN/DATE/SELECT), `required`, `defaultValue`, `jsonMappingKey`, `validationRules` (éditeur JSON) ;
* ajout en lot via `POST .../form/fields`.

> L’ajout d’images et l’annotation ne sont pas bloqués par l’absence de formulaire **pour les images**, mais l’annotation nécessite un formulaire complet (statut `READY`). L’UI guide l’utilisateur dans cet ordre.

## 8.5 Images (onglet)

* table/galerie paginée (`GET .../images?page=&size=`) ;
* bouton « Ajouter une image » → formulaire : `s3Bucket`, `s3Key`, `metadata` (éditeur JSON avec validation de syntaxe) ;
* l’ajout d’images est autorisé dès le statut `DRAFT` ;
* chaque vignette/ligne indique si l’image est déjà annotée (pastille) et propose « Annoter » ou « Voir l’annotation ».

## 8.6 Écran d’annotation

Cœur fonctionnel de l’application :

1. au chargement, appel `GET .../annotation-form` pour obtenir le formulaire prérempli ;
2. génération **dynamique** d’un Reactive Form à partir des champs (composant `dynamic-form`) :
   * `TEXT`/`SELECT` → input texte / select ;
   * `NUMBER` → input numérique ;
   * `BOOLEAN` → toggle ;
   * `DATE` → Flatpickr ;
3. les champs `autoFilled = true` sont préremplis et visuellement marqués (icône « auto ») ;
4. l’utilisateur complète/corrige, puis sauvegarde (`POST .../annotations`) ;
5. l’`imageId` provient de l’URL (jamais du corps), conformément au contrat ;
6. les valeurs sont envoyées en `string` (le typage/validation est refait côté API).

Disposition : aperçu de l’image (panneau gauche) + formulaire d’annotation (panneau droit), pattern « split view » TailAdmin.

> Si l’image possède déjà une annotation (`GET .../annotation` ≠ 404), l’écran bascule en lecture seule et propose la consultation.

---

# 9. Routing

Routes standalone avec lazy loading par feature.

```typescript
export const routes: Routes = [
  { path: '', component: LayoutComponent, children: [
    { path: 'dashboard', loadComponent: () => import('./features/dashboard/dashboard.component') },
    { path: 'projects', loadComponent: () => import('./features/projects/project-list.component') },
    { path: 'projects/:projectId', loadComponent: () => import('./features/projects/project-detail.component'),
      children: [
        { path: 'overview',    loadComponent: () => import('./features/projects/project-overview.component') },
        { path: 'form',        loadComponent: () => import('./features/forms/form-editor.component') },
        { path: 'images',      loadComponent: () => import('./features/images/image-list.component') },
        { path: 'annotations', loadComponent: () => import('./features/annotations/annotation-list.component') },
        { path: '', redirectTo: 'overview', pathMatch: 'full' },
      ] },
    { path: 'projects/:projectId/images/:imageId/annotate',
      loadComponent: () => import('./features/annotations/annotate.component') },
    { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
  ] },
];
```

---

# 10. Gestion d’État (Signals)

Un store léger par domaine, à base de Signals (pas de NgRx requis pour ce périmètre) :

* état exposé en `signal()` / `computed()` (lecture) ;
* mutations via méthodes du store qui appellent les services API et mettent à jour les signaux ;
* dérivations utiles en `computed` : ex. `canPublish = computed(() => hasForm() && fieldCount() > 0)` pour activer le bouton « Passer à READY ».

```text
ProjectStore   → projects(), selectedProject(), status transitions
FormStore      → form(), fields(), canPublish()
ImageStore     → images(), pagination, annotatedFlags()
AnnotationStore→ prefilledForm(), saving(), annotationByImage()
```

---

# 11. Formulaire Dynamique & Validation

Le composant `dynamic-form` construit un `FormGroup` à partir des `FormField` :

* `required` → `Validators.required` ;
* `validationRules` (JSON) interprétées en validateurs Angular (ex. `min`, `max`, `pattern`, `maxLength`) ;
* le typage d’affichage suit `fieldType`, mais la **valeur soumise est sérialisée en `string`** pour respecter le contrat API ;
* la validation front est un confort UX ; la validation **faisant autorité** reste celle de l’API (conversion typée puis application des `validationRules`).

---

# 12. Design System TailAdmin

Éléments du template réutilisés :

* **Layout** : sidebar rétractable + header + zone de contenu ; breadcrumb par page.
* **Navigation** : entrées sidebar → Dashboard, Projets (et sous-navigation par onglets dans le détail).
* **Composants UI** : cartes KPI, tables, badges de statut, boutons, modales, dropdowns, toggles, alertes/toasts.
* **Formulaires** : inputs, selects, checkboxes/toggles, Flatpickr (dates), éditeur JSON (textarea stylé + validation).
* **Charts** : ApexCharts pour le dashboard.
* **Thème** : mode clair/sombre TailAdmin, palette Tailwind v4.
* **Responsive** : sidebar repliée en burger sur mobile, tables scrollables.

---

# 13. Gestion des Erreurs & Feedback

* Intercepteur global : déballe l’enveloppe API, transforme `error` en `ApiError`.
* Service de notifications (toasts TailAdmin) pour succès / erreurs.
* États de chargement : indicateurs (skeletons / spinners) pilotés par des signaux `loading()`.
* Erreurs métier (ex. transition de statut invalide) affichées avec le `message` renvoyé par l’API.
* `404` sur `GET .../annotation` traité comme « non encore annotée » (pas une erreur bloquante).

---

# 14. Structure du Projet Angular

```text

    ├── src/
    │   ├── app/
    │   │   ├── core/
    │   │   │   ├── api/            (ProjectApiService, FormApiService, ImageApiService, AnnotationApiService)
    │   │   │   ├── interceptors/   (api-response.interceptor.ts, error.interceptor.ts)
    │   │   │   ├── models/         (interfaces TS)
    │   │   │   └── state/          (stores Signals)
    │   │   ├── layout/             (coquille TailAdmin)
    │   │   ├── shared/             (table, badge, modal, dynamic-form, json-editor)
    │   │   ├── features/
    │   │   │   ├── dashboard/
    │   │   │   ├── projects/
    │   │   │   ├── forms/
    │   │   │   ├── images/
    │   │   │   └── annotations/
    │   │   ├── app.config.ts       (providers : router, httpClient + interceptors)
    │   │   └── app.routes.ts
    │   ├── environments/           (apiBaseUrl)
    │   └── styles.css              (Tailwind v4 + thème TailAdmin)
    ├── tailwind.config (v4)
    ├── angular.json
    └── package.json
```

---

# 15. Recommandations Importantes

# Refléter les règles de l’API, ne pas les réimplémenter

Les transitions de statut, l’unicité de l’annotation par image et la validation typée sont garanties par l’API. Le front se contente de **refléter** ces règles (activer/désactiver des actions, afficher les messages d’erreur) pour éviter les divergences.

# Cohérence des routes formulaire

Toutes les opérations sur le formulaire et ses champs passent par `{projectId}` (`/api/projects/{projectId}/form[...]`), conformément au contrat 1‑1 où le projet ne porte pas de `formId`.

# Valeurs d’annotation en chaîne

Les valeurs envoyées et reçues sont des `string`. Le composant `dynamic-form` se charge de l’affichage typé (toggle, date, nombre) mais sérialise toujours en `string` à la soumission.

# Pagination

Les listes d’images utilisent la pagination de l’API (`page`, `size`) et le composant de pagination TailAdmin.

# Mode sombre & accessibilité

Activer le thème sombre TailAdmin et veiller au contraste des badges de statut ; libellés ARIA sur les actions de la table et les champs dynamiques.