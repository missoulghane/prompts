# API REST Spring Boot — Plateforme d’Annotation d’Images
# Nom de code du projet : TAGTIC

# 1. Objectif

Mettre en place une API REST publique avec Spring Boot (sans Spring Security) permettant de :

* gérer des projets d’annotation ;
* configurer des formulaires d’annotation dynamiques ;
* associer des images à un projet ;
* annoter les images d’un projet selon un formulaire ;
* préremplir automatiquement certains champs à partir des métadonnées JSON des images ;
* tracer chaque valeur d’annotation par champ du formulaire.

---

# 2. Stack Technique

## Backend

* Java 21
* Spring Boot 3.x
* Spring Web
* Spring Data JPA
* Hibernate
* H2 (base de données embarquée, en mémoire et/ou fichier)
* Bean Validation (`jakarta.validation`)
* Lombok
* OpenAPI / Swagger

## Base de Données

La base de données utilisée est **H2** :

* H2 en mode embarqué (in-memory pour les tests, mode fichier pour la persistance locale) ;
* console H2 activée pour l’inspection (`/h2-console`) ;
* dialecte Hibernate `H2Dialect` ;
* schéma généré via `ddl-auto` (Hibernate) ou scripts `schema.sql` / `data.sql`.

### Exemple de configuration `application.yml`

```yaml
spring:
  datasource:
    # Mode fichier : la base est persistée sur disque et survit aux redémarrages.
    # (Pour les tests d'intégration uniquement, on peut utiliser jdbc:h2:mem:tagtic;DB_CLOSE_DELAY=-1)
    url: jdbc:h2:file:./data/tagtic;AUTO_SERVER=TRUE
    driver-class-name: org.h2.Driver
    username: sa
    password:
  jpa:
    hibernate:
      ddl-auto: update
    properties:
      hibernate:
        dialect: org.hibernate.dialect.H2Dialect
        format_sql: true
    show-sql: true
  h2:
    console:
      enabled: true
      path: /h2-console
```

> **Persistance** : le mode `jdbc:h2:file:./data/tagtic` écrit la base dans `./data/`, donc les projets, formulaires et références d’images S3 survivent aux redémarrages. Le mode `mem:` (in-memory) vide intégralement la base à chaque arrêt de l’application — à réserver aux tests automatisés.

---

# 3. Stockage des Images

Les images sont stockées sur un serveur S3 compatible :

* AWS S3

L’API ne stocke que :

* le `s3Bucket` (nom du bucket) ;
* la `s3Key` (chemin/clé du fichier dans le bucket) ;
* les métadonnées JSON.

> Le couple `s3Bucket` + `s3Key` est requis pour interagir avec le SDK AWS (URLs signées, opérations sécurisées). Une simple URL publique ne suffit pas. L’URL d’accès peut être reconstruite ou présignée à la volée côté applicatif à partir de ces deux informations.

---

# 4. Architecture Métier

```text
Projet d’annotation
    ├── Formulaire d’annotation
    │       └── Champs du formulaire
    │
    ├── Images
    │       └── Métadonnées JSON
    │
    └── Annotations
            └── Valeurs d’annotation par champ
```

---

# 5. Modèle de Données

# 5.1 AnnotationProject

Projet principal d’annotation.

## Champs

| Champ       | Type    | Description                             |
| ----------- | ------- | --------------------------------------- |
| id          | UUID    | Identifiant                             |
| title       | String  | Titre                                   |
| description | Text    | Description                             |
| status      | ENUM    | DRAFT / READY / IN_PROGRESS / COMPLETED / ARCHIVED |
| createdBy   | String  | Créateur                                |
| createdAt   | Instant | Date création                           |
| updatedAt   | Instant | Date modification                       |

> **Pas de champ `formId` ici.** La relation 1‑1 est portée par `AnnotationForm.projectId` (clé étrangère `project_id` avec contrainte `UNIQUE`). Cela évite le problème de l’œuf et de la poule : un projet est créé seul (statut `DRAFT`), puis un formulaire vient s’y rattacher ensuite. Pour récupérer le formulaire d’un projet, on requête `AnnotationForm` par `projectId`.

---

# 5.2 AnnotationForm

Définition du formulaire d’annotation.

## Champs

| Champ       | Type    | Description                       |
| ----------- | ------- | --------------------------------- |
| id          | UUID    | Identifiant                       |
| projectId   | UUID    | projet propriétaire (obligatoire, `UNIQUE` → relation 1‑1) |
| title       | String  |                                   |
| description | String  |                                   |
| version     | Integer |                                   |
| createdBy   | String  |                                   |
| createdAt   | Instant |                                   |

---

# 5.3 FormField

Définition dynamique d’un champ du formulaire.

## Champs

| Champ           | Type    | Description                               |
| --------------- | ------- | ----------------------------------------- |
| id              | UUID    |                                           |
| formId          | UUID    |                                           |
| name            | String  | clé technique                             |
| label           | String  | libellé affiché                           |
| type            | ENUM    | TEXT / NUMBER / BOOLEAN / DATE / SELECT   |
| required        | Boolean |                                           |
| orderIndex      | Integer | ordre affichage                           |
| defaultValue    | String  |                                           |
| jsonMappingKey  | String  | clé metadata utilisée pour préremplissage |
| validationRules | JSON    | règles dynamiques (stockées en JSON H2)   |

---

# 5.4 ProjectImage

Image appartenant à un projet.

## Champs

| Champ     | Type    | Description                          |
| --------- | ------- | ------------------------------------ |
| id        | UUID    |                                      |
| projectId | UUID    |                                      |
| s3Bucket  | String  | nom du bucket S3                     |
| s3Key     | String  | clé / chemin du fichier dans le bucket |
| metadata  | JSON    | métadonnées JSON de l’image          |
| createdAt | Instant |                                      |

## Exemple metadata

```json 
{
  "classification": "CHEQUE",
  "extractions": 
  {
    "amount":12.5,
    "account":"001745778710005210035"
  }
}
```

---

# 5.5 Annotation

Annotation globale d’une image.

## Champs

| Champ       | Type    | Description                    |
| ----------- | ------- | ------------------------------ |
| id          | UUID    |                                |
| projectId   | UUID    | projet concerné                |
| imageId     | UUID    | image annotée                  |
| annotatedBy | String  | utilisateur                    |
| annotatedAt | Instant | date annotation                |
| status      | ENUM    | PENDING / VALIDATED / REJECTED |

> **Contrainte d’unicité** : une image ne peut avoir qu’**une seule annotation finale**. Ajouter une contrainte `UNIQUE` sur `image_id`. Cela protège contre la concurrence : si deux utilisateurs récupèrent le formulaire prérempli de la même image et soumettent en parallèle, la seconde insertion échoue proprement (conflit) au lieu de créer un doublon. (Si plusieurs annotateurs distincts doivent pouvoir annoter une même image, remplacer par une contrainte `UNIQUE (image_id, annotated_by)`.)

---

# 5.6 AnnotationFieldValue

Valeur d’annotation associée à un champ du formulaire.

## Champs

| Champ             | Type    | Description               |
| ----------------- | ------- | ------------------------- |
| id                | UUID    |                           |
| annotationId      | UUID    | annotation parent         |
| formFieldId       | UUID    | champ du formulaire       |
| fieldName         | String  | snapshot du nom technique |
| fieldLabel        | String  | snapshot du label         |
| fieldType         | ENUM    | snapshot du type          |
| value             | String  | valeur saisie (stockée en texte)   |
| autoFilled        | Boolean | valeur issue du metadata  |
| sourceMetadataKey | String  | clé metadata utilisée     |
| createdAt         | Instant | date création             |

> **Important** : `value` est un `String` (stockage en texte brut). C’est `fieldType` (snapshoté) qui pilote le typage côté applicatif. Le type `JSON` n’est **pas** utilisé ici : il est réservé aux structures complexes comme `validationRules` (FormField) et `metadata` (ProjectImage).
>
> **Pipeline de validation (ordre imposé)** : à la réception, le use case (1) lit la `String`, (2) la **convertit vers le type cible** selon `fieldType` (`NUMBER` → `BigDecimal`, `BOOLEAN` → `Boolean`, `DATE` → `LocalDate`, `TEXT`/`SELECT` → `String`), (3) **applique alors les `validationRules`** (JSON) sur la valeur typée — jamais sur la chaîne brute (min/max sur un `BigDecimal`, regex sur un `String`, etc.). Si la conversion échoue, l’annotation est rejetée avec une erreur de validation. Ce n’est qu’après validation réussie que la valeur est re-sérialisée en `String` pour persistance. Le préremplissage suit la même logique : la valeur extraite des métadonnées JSON (ex. le flottant `12.5`) est convertie selon `fieldType` puis transportée en `String` dans le modèle.

---

# 6. Relations

```text
AnnotationProject 1---1 AnnotationForm   (FK project_id UNIQUE portée par AnnotationForm)

AnnotationForm 1---N FormField

AnnotationProject 1---N ProjectImage

ProjectImage 1---1 Annotation            (une image = une annotation finale)

Annotation 1---N AnnotationFieldValue

AnnotationFieldValue N---1 FormField
```

---

# 7. Organisation des Use Cases

Les use cases regroupent la logique métier de l’application. Ils sont organisés par domaine fonctionnel et constituent la couche applicative (use case = une intention métier, point d’entrée appelé par les controllers). Dans cette architecture orientée Use Cases, **les use cases attaquent directement les `repository`** (via leurs interfaces) ; il n’y a pas de couche `service` intermédiaire redondante. Les dépendances purement techniques (accès S3, etc.) sont isolées dans une couche `infrastructure`.

```text
Use Cases
    ├── Project
    │       ├── CreateProjectUseCase
    │       ├── GetProjectUseCase
    │       ├── ListProjectsUseCase
    │       ├── UpdateProjectUseCase
    │       ├── DeleteProjectUseCase
    │       └── ChangeProjectStatusUseCase
    │
    ├── Form
    │       ├── CreateFormUseCase
    │       ├── GetFormUseCase
    │       ├── AddFormFieldUseCase
    │       └── ListFormFieldsUseCase
    │
    ├── Image
    │       ├── AddImageToProjectUseCase
    │       ├── ListProjectImagesUseCase
    │       └── GetImageUseCase
    │
    └── Annotation
            ├── GetPrefilledAnnotationFormUseCase
            ├── SaveAnnotationUseCase
            ├── ListProjectAnnotationsUseCase
            └── GetImageAnnotationUseCase
```

## 7.1 Use Cases — Project

| Use Case                    | Description                                              | Endpoint                              |
| --------------------------- | ------------------------------------------------------- | ------------------------------------- |
| CreateProjectUseCase        | Créer un projet d’annotation (statut initial DRAFT)     | `POST /api/projects`                  |
| GetProjectUseCase           | Récupérer le détail d’un projet                         | `GET /api/projects/{id}`              |
| ListProjectsUseCase         | Lister les projets                                      | `GET /api/projects`                   |
| UpdateProjectUseCase        | Modifier les informations d’un projet                   | `PUT /api/projects/{id}`              |
| DeleteProjectUseCase        | Supprimer un projet                                     | `DELETE /api/projects/{id}`           |
| ChangeProjectStatusUseCase  | Faire évoluer le statut du projet (transitions contrôlées) | `PATCH /api/projects/{id}/status` |

### Cycle de vie du statut projet

Les transitions de statut sont **contrôlées** par `ChangeProjectStatusUseCase` (et non par une simple écriture libre du champ) :

| De → Vers              | Condition                                                                 |
| ---------------------- | ------------------------------------------------------------------------- |
| `DRAFT` → `READY`      | Un `AnnotationForm` est rattaché au projet **et** contient ≥ 1 `FormField`. |
| `READY` → `IN_PROGRESS`| Au moins une image a été annotée (première annotation créée).             |
| `IN_PROGRESS` → `COMPLETED` | Toutes les images du projet possèdent une annotation (selon la règle métier retenue). |
| `* (sauf COMPLETED en cours)` → `ARCHIVED` | Archivage manuel.                                            |

> **Règles de garde associées** :
> - L’**ajout d’images** (`AddImageToProjectUseCase`) est **autorisé dès `DRAFT`** (et `READY`) : on peut constituer le lot d’images avant même d’avoir finalisé le formulaire. Il est en revanche refusé sur un projet `COMPLETED` ou `ARCHIVED`.
> - La **création d’annotations** (`SaveAnnotationUseCase`) est **refusée tant que le projet n’est pas `READY`** (ou `IN_PROGRESS`) : annoter exige un formulaire rattaché contenant au moins un champ. Annotation impossible en `DRAFT`, `COMPLETED` ou `ARCHIVED`.
> - Un projet `ARCHIVED` est en lecture seule.

> **Note sur l’enchaînement des statuts** : la condition `DRAFT → READY` ne porte **que** sur le formulaire (présence + ≥ 1 champ), pas sur les images. Des images peuvent donc déjà avoir été ajoutées pendant la phase `DRAFT`. Une fois en `READY`, l’annotation devient possible, ce qui déclenche le passage vers `IN_PROGRESS`.

## 7.2 Use Cases — Form

| Use Case                | Description                                       | Endpoint                                       |
| ----------------------- | ------------------------------------------------- | ---------------------------------------------- |
| CreateFormUseCase       | Créer un formulaire d’annotation lié au projet (version = 1) | `POST /api/projects/{projectId}/form`  |
| GetFormUseCase          | Récupérer le formulaire du projet                 | `GET /api/projects/{projectId}/form`           |
| AddFormFieldUseCase     | Ajouter un ou plusieurs champs au formulaire du projet | `POST /api/projects/{projectId}/form/fields` |
| ListFormFieldsUseCase   | Lister les champs du formulaire du projet         | `GET /api/projects/{projectId}/form/fields`    |

> **Cohérence des routes** : puisque la relation projet ↔ formulaire est 1‑1 et que le projet ne porte pas de `formId`, toutes les routes du formulaire et de ses champs sont ancrées sur `{projectId}` (et non sur `{formId}`). Le formulaire est une sous‑ressource unique du projet, accessible via `/api/projects/{projectId}/form`.

## 7.3 Use Cases — Image

| Use Case                  | Description                                  | Endpoint                                    |
| ------------------------- | -------------------------------------------- | ------------------------------------------- |
| AddImageToProjectUseCase  | Ajouter une image (s3Bucket + s3Key + metadata) au projet | `POST /api/projects/{projectId}/images`  |
| ListProjectImagesUseCase  | Lister les images d’un projet (paginé)       | `GET /api/projects/{projectId}/images`      |
| GetImageUseCase           | Récupérer le détail d’une image              | `GET /api/images/{imageId}`                 |

## 7.4 Use Cases — Annotation

| Use Case                          | Description                                                                 | Endpoint                                                       |
| --------------------------------- | -------------------------------------------------------------------------- | ------------------------------------------------------------- |
| GetPrefilledAnnotationFormUseCase | Charger le formulaire du projet prérempli avec les métadonnées de l’image  | `GET /api/projects/{projectId}/images/{imageId}/annotation-form` |
| SaveAnnotationUseCase             | Sauvegarder une annotation et ses valeurs par champ (avec snapshot)        | `POST /api/projects/{projectId}/images/{imageId}/annotations` |
| ListProjectAnnotationsUseCase     | Lister les annotations d’un projet                                          | `GET /api/projects/{projectId}/annotations`                   |
| GetImageAnnotationUseCase         | Récupérer l’annotation (unique) d’une image, ou `404` si non annotée | `GET /api/projects/{projectId}/images/{imageId}/annotation`  |

---

# 8. Workflow Métier

# Étape 1 — Création du projet

```http
POST /api/projects
```

Payload :

```json
{
  "title": "Projet Annotation Chèques",
  "description": "Annotation des chèques bancaires numérisés"
}
```

---

# Étape 2 — Création du formulaire (directement rattaché au projet)

```http
POST /api/projects/{projectId}/form
```

Le `projectId` est passé dans l’URL : le formulaire est créé et lié au projet en une seule opération (relation 1‑1). Aucun formulaire orphelin ne peut exister.

Payload :

```json
{
  "title": "Formulaire Chèque",
  "description": "Champs d’annotation d’un chèque"
}
```

---

# Étape 3 — Ajout des champs

```http
POST /api/projects/{projectId}/form/fields
```

Exemple :

```json
[
  {
    "name": "account",
    "label": "N° de compte",
    "type": "TEXT",
    "required": true,
    "jsonMappingKey": "extractions.account"
  },
  {
    "name": "amount",
    "label": "Montant du chèque",
    "type": "NUMBER",
    "jsonMappingKey": "extractions.amount"
  }
]
```

---

# Étape 4 — Ajout des images au projet

```http
POST /api/projects/{projectId}/images
```

Payload :

```json
{
  "s3Bucket": "tagtic-images",
  "s3Key": "cheques/img1.png",
  "metadata": {
    "classification": "CHEQUE",
    "extractions": 
    {
      "amount":12.5,
      "account":"001745778710005210035"
    }
  }
}
```

---

# Étape 5 — Annotation des images

L’utilisateur :

1. charge une image du projet ;
2. récupère le formulaire du projet ;
3. obtient un préremplissage automatique ;
4. complète les champs ;
5. sauvegarde l’annotation.

---

# 9. Préremplissage Automatique

Chaque champ du formulaire peut être lié à une clé des métadonnées JSON.

## Exemple

Champ :

```text
name = amount
jsonMappingKey = extractions.amount
```

Metadata image :

```json
{
  "classification": "CHEQUE",
  "extractions": {
    "amount": 12.5
  }
}
```

Préremplissage automatique de la valeur du champ (castée selon `fieldType = NUMBER`) :

```json
{
  "amount": 12.5
}
```

---

# 10. Exemple d’Annotation

# Formulaire

```json 
[
  {
    "id": "field-1",
    "name": "amount",
    "label": "Montant du chèque",
    "type": "NUMBER",
    "jsonMappingKey": "extractions.amount"
  },
  {
    "id": "field-2",
    "name": "account",
    "label": "N° de compte",
    "type": "TEXT",
    "jsonMappingKey": "extractions.account"
  }
]
```

---

# Metadata image

```json 
{
  "classification": "CHEQUE",
  "extractions": {
    "amount": 12.5,
    "account": "001745778710005210035"
  }
}
```

---

# Annotation créée

## Annotation

```json
{
  "id": "annotation-1",
  "projectId": "project-1",
  "imageId": "image-1",
  "annotatedBy": "user1",
  "status": "PENDING"
}
```

---

## AnnotationFieldValues

```json
[
  {
    "formFieldId": "field-1",
    "fieldName": "amount",
    "fieldType": "NUMBER",
    "value": "12.5",
    "autoFilled": true,
    "sourceMetadataKey": "extractions.amount"
  },
  {
    "formFieldId": "field-2",
    "fieldName": "account",
    "fieldType": "TEXT",
    "value": "001745778710005210035",
    "autoFilled": true,
    "sourceMetadataKey": "extractions.account"
  }
]
```

> Toutes les valeurs sont stockées en `String`. Pour `field-1`, bien que le type soit `NUMBER`, la valeur persistée est la chaîne `"12.5"` ; le cast vers un nombre se fait côté applicatif via `fieldType`.

---

# 11. API REST

# 11.1 Projects API

## Créer un projet

```http
POST /api/projects
```

## Lister les projets

```http
GET /api/projects
```

## Détail d’un projet

```http
GET /api/projects/{id}
```

## Modifier un projet

```http
PUT /api/projects/{id}
```

## Supprimer un projet

```http
DELETE /api/projects/{id}
```

## Changer le statut d’un projet

```http
PATCH /api/projects/{id}/status
```

Payload :

```json
{
  "status": "READY"
}
```

> Les transitions sont contrôlées (cf. 7.1 et 15). Une transition invalide (ex. `DRAFT` → `READY` sans formulaire complet) renvoie une erreur métier.

---

# 11.2 Forms API

Le formulaire est une sous‑ressource unique du projet (relation 1‑1). Toutes les routes sont ancrées sur `{projectId}`.

## Créer le formulaire du projet

```http
POST /api/projects/{projectId}/form
```

## Récupérer le formulaire du projet

```http
GET /api/projects/{projectId}/form
```

## Ajouter un ou plusieurs champs

```http
POST /api/projects/{projectId}/form/fields
```

## Lister les champs

```http
GET /api/projects/{projectId}/form/fields
```

---

# 11.3 Images API

## Ajouter une image au projet

```http
POST /api/projects/{projectId}/images
```

## Lister les images d’un projet

```http
GET /api/projects/{projectId}/images
```

## Détail d’une image

```http
GET /api/images/{imageId}
```

---

# 11.4 Annotation API

## Charger le formulaire prérempli d’une image

```http
GET /api/projects/{projectId}/images/{imageId}/annotation-form
```

## Exemple réponse

```json
{
  "imageId": "image-1",
  "fields": [
    {
      "formFieldId": "field-1",
      "name": "amount",
      "type": "NUMBER",
      "value": "12.5",
      "autoFilled": true
    },
    {
      "formFieldId": "field-2",
      "name": "account",
      "type": "TEXT",
      "value": "001745778710005210035",
      "autoFilled": true
    }
  ]
}
```

---

## Sauvegarder une annotation

L’`imageId` fait partie du chemin REST (l’annotation est intrinsèquement liée à une image). Il n’est donc plus dans le payload, ce qui évite d’envoyer par erreur une image appartenant à un autre projet.

```http
POST /api/projects/{projectId}/images/{imageId}/annotations
```

Payload :

```json
{
  "annotatedBy": "user1",
  "fields": [
    {
      "formFieldId": "field-1",
      "value": "12.5"
    },
    {
      "formFieldId": "field-2",
      "value": "001745778710005210035"
    }
  ]
}
```

> Le use case vérifie que `imageId` appartient bien à `projectId` avant toute écriture, et s’appuie sur la contrainte `UNIQUE (image_id)` pour rejeter une double soumission concurrente.

---

## Lister les annotations d’un projet

```http 
GET /api/projects/{projectId}/annotations
```

---

## Récupérer l’annotation d’une image

Une image n’ayant qu’une seule annotation finale (contrainte `UNIQUE (image_id)`), la route est au **singulier** et renvoie un objet unique, ou `404` si l’image n’est pas encore annotée.

```http 
GET /api/projects/{projectId}/images/{imageId}/annotation
```

---

# 12. Réponse API Standardisée

# Success

```json 
{
  "success": true,
  "data": {}
}
```

---

# Error

```json
{
  "success": false,
  "error": {
    "code": "PROJECT_NOT_FOUND",
    "message": "Project not found"
  }
}
```

---

# 13. Structure Projet Spring Boot

La structure intègre une couche `usecase` dédiée pour matérialiser l’organisation des use cases décrite en section 7. Il n’y a **pas** de couche `service` : les use cases portent la logique applicative et attaquent directement les `repository`. Les dépendances techniques (S3, etc.) sont isolées dans `infrastructure`.

```text
src/main/java
    ├── controller
    ├── usecase
    │       ├── project
    │       ├── form
    │       ├── image
    │       └── annotation
    ├── infrastructure
    │       └── s3
    ├── repository
    ├── entity
    ├── dto
    ├── mapper
    ├── exception
    ├── validation
    └── config
```

> Note : un use case = une intention métier (ex : `SaveAnnotationUseCase`). Il appelle directement les interfaces `repository` et, si nécessaire, les composants de la couche `infrastructure` (ex : client S3) — sans couche `service` intermédiaire qui dupliquerait la logique.
>
> **Répartition des responsabilités (pour éviter que les use cases ne gonflent)** :
> - le **Controller** reçoit le `RequestDTO`, le convertit en *commande* (objet de commande dédié, ou simples paramètres Java), puis appelle le use case ; il re-mappe l’entité / modèle métier retourné en `ResponseDTO` ;
> - le **Use Case** ne connaît **ni les DTOs HTTP ni la sérialisation** : il reçoit une commande, exécute la règle métier, manipule entités et `repository`, et renvoie une entité ou un modèle métier ;
> - le **Mapper** centralise les conversions DTO ⇄ entité pour ne pas polluer les use cases.

---

# 14. Gestion H2 JSON

H2 permet de stocker du JSON. Le stockage JSON H2 est réservé aux **structures complexes** :

* `metadata` (ProjectImage)
* `validationRules` (FormField)

> Le champ `value` de `AnnotationFieldValue` n’est **pas** stocké en JSON : c’est un simple `String` (voir 5.6). Cela simplifie les requêtes, l’indexation et le mapping Hibernate ; le typage est restitué côté applicatif via `fieldType`.

## Approche recommandée

* Stocker les champs JSON en colonne `CLOB` / `VARCHAR`, ou via le type natif `JSON` de H2 ;
* Mapper côté Hibernate avec un `AttributeConverter` (JSON ⇄ Object) ou le support `@JdbcTypeCode(SqlTypes.JSON)` de Hibernate 6 ;
* La console H2 (`/h2-console`) permet d’inspecter les valeurs JSON stockées.

# Exemple Hibernate

Pour un champ complexe (ex : `metadata` ou `validationRules`) :

```java
@JdbcTypeCode(SqlTypes.JSON)
@Column(columnDefinition = "json")
private Map<String, Object> metadata;
```

Pour la valeur d’annotation, un simple String suffit :

```java
@Column(name = "value")
private String value;
```

---

# 15. États Métier

# Projet

```text 
DRAFT
READY
IN_PROGRESS
COMPLETED
ARCHIVED
```

Transitions autorisées (gérées par `ChangeProjectStatusUseCase`, cf. 7.1) :

```text
DRAFT ──(formulaire + ≥1 champ)──► READY ──(1ère annotation)──► IN_PROGRESS ──(toutes images annotées)──► COMPLETED
   │                                  │                              │                                        │
   └──────────────────────────────── ARCHIVED ◄───────────────────┴────────────────────────────────────────┘
```

> Les images peuvent être ajoutées dès `DRAFT`. Seule la **création d’annotations** est bloquée tant que le projet n’est pas `READY` (formulaire avec ≥ 1 champ).

---

# Annotation

```text 
PENDING
VALIDATED
REJECTED
```

---

# 16. Swagger / OpenAPI


---

# 17. DTO

# Requests (exemples)

```text 
CreateProjectRequest
CreateFormRequest
AddFieldRequest
CreateAnnotationRequest
```

---

# Responses

```text
ProjectResponse
FormResponse
AnnotationResponse
```

---

# 18. Recommandations Importantes

# Versionner les formulaires

Ajouter un champ :

```text 
version
```

sur `AnnotationForm`.

---

# Snapshotter les champs dans AnnotationFieldValue

Conserver :

* fieldName
* fieldLabel
* fieldType

afin de garantir la cohérence historique.

---

# Pagination

Prévoir :

```http
GET /api/projects/{id}/images?page=0&size=20
```

---

# Recherche JSON (H2)

Prévoir des filtres JSON. H2 expose des fonctions JSON permettant d’interroger le contenu :

```sql 
SELECT * FROM project_image
WHERE JSON_VALUE(metadata, '$.classification') = 'CHEQUE';
```

---

# Contraintes d’intégrité à implémenter

Synthèse des contraintes base de données / métier issues du modèle :

* `AnnotationForm.project_id` : `UNIQUE` (relation 1‑1 projet ↔ formulaire ; pas de `formId` côté projet).
* `Annotation.image_id` : `UNIQUE` (une seule annotation finale par image ; protège la concurrence). Variante multi‑annotateurs : `UNIQUE (image_id, annotated_by)`.
* Transitions de statut projet contrôlées par `ChangeProjectStatusUseCase`. L’ajout d’images est autorisé dès `DRAFT` ; seule la **création d’annotations** est refusée tant que le projet n’est pas `READY` (formulaire avec ≥ 1 champ requis). Projet `ARCHIVED` = lecture seule.
* Formulaire = sous‑ressource unique du projet : toutes les routes du formulaire et des champs sont ancrées sur `{projectId}` (`/api/projects/{projectId}/form[/fields]`).
* Récupération de l’annotation d’une image au singulier (`GET .../images/{imageId}/annotation`) → objet unique ou `404`.
* `ProjectImage` : `s3Bucket` + `s3Key` (jamais une URL brute).
* `AnnotationFieldValue.value` : `String` ; conversion typée selon `fieldType` **avant** application des `validationRules`.
